import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

  private generateSlug(name: string): string {
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '');

    if (!slug) {
      throw new BadRequestException('Invalid exam name.');
    }

    return slug;
  }

  private async ensureInstitutionExists(institutionId?: string) {
    if (!institutionId) {
      return null;
    }

    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
    });

    if (!institution) {
      throw new NotFoundException('Institution not found.');
    }

    if (!institution.isActive) {
      throw new BadRequestException(
        'Cannot assign an exam to an inactive institution.',
      );
    }

    return institution;
  }

  private async ensureUniqueSlug(
    slug: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.exam.findFirst({
      where: {
        slug: {
          equals: slug,
          mode: 'insensitive',
        },
        ...(excludeId
          ? {
              NOT: { id: excludeId },
            }
          : {}),
      },
    });

    if (existing) {
      throw new ConflictException(
        'An exam with this slug already exists.',
      );
    }
  }

  async create(dto: CreateExamDto) {
    const name = dto.name.trim();

    const institution = await this.ensureInstitutionExists(
      dto.institutionId,
    );

    const slug = dto.slug?.trim()
      ? this.generateSlug(dto.slug)
      : this.generateSlug(name);

    const existing = await this.prisma.exam.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
        institutionId: dto.institutionId ?? null,
      },
    });

    if (existing) {
      throw new ConflictException(
        'An exam with this name already exists for this institution.',
      );
    }

    await this.ensureUniqueSlug(slug);

    try {
      const exam = await this.prisma.exam.create({
        data: {
          name,
          slug,
          examType: dto.examType?.trim() || null,
          description: dto.description?.trim() || null,
          ...(institution
            ? {
                institution: {
                  connect: { id: institution.id },
                },
              }
            : {}),
        },
        include: {
          institution: true,
          _count: {
            select: {
              occurrences: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Exam created successfully.',
        data: exam,
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Exam already exists.');
      }

      throw error;
    }
  }

  async findAll(query: {
    search?: string;
    institutionId?: string;
    examType?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    if (query.institutionId && !this.isValidUuid(query.institutionId)) {
      throw new BadRequestException('Invalid institutionId.');
    }

    const search = query.search?.trim();

    const where: Prisma.ExamWhereInput = {
      ...(search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                slug: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
      ...(query.institutionId
        ? { institutionId: query.institutionId }
        : {}),
      ...(query.examType
        ? {
            examType: {
              equals: query.examType.trim(),
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const [exams, total] = await Promise.all([
      this.prisma.exam.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { name: 'asc' },
          { createdAt: 'desc' },
        ],
        include: {
          institution: true,
          _count: {
            select: {
              occurrences: true,
            },
          },
        },
      }),

      this.prisma.exam.count({ where }),
    ]);

    return {
      success: true,
      data: exams,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        institution: true,
        occurrences: {
          orderBy: [
            { examYear: 'desc' },
            { createdAt: 'desc' },
          ],
          take: 50,
          select: {
            id: true,
            questionId: true,
            examYear: true,
            postName: true,
            department: true,
            questionNumber: true,
            source: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            occurrences: true,
          },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException('Exam not found.');
    }

    return {
      success: true,
      data: exam,
    };
  }

  async update(id: string, dto: UpdateExamDto) {
    const existing = await this.prisma.exam.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Exam not found.');
    }

    const hasChanges = Object.values(dto).some(
      (value) => value !== undefined,
    );

    if (!hasChanges) {
      throw new BadRequestException(
        'At least one field is required for update.',
      );
    }

    const name = dto.name?.trim();

    if (dto.name !== undefined && !name) {
      throw new BadRequestException('Exam name cannot be empty.');
    }

    const institutionId =
      dto.institutionId !== undefined
        ? dto.institutionId
        : existing.institutionId;

    await this.ensureInstitutionExists(institutionId ?? undefined);

    if (
      name !== undefined ||
      dto.institutionId !== undefined
    ) {
      const duplicate = await this.prisma.exam.findFirst({
        where: {
          name: {
            equals: name ?? existing.name,
            mode: 'insensitive',
          },
          institutionId: institutionId ?? null,
          NOT: { id },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          'An exam with this name already exists for this institution.',
        );
      }
    }

    const slug =
      dto.slug !== undefined
        ? this.generateSlug(dto.slug)
        : name !== undefined
          ? this.generateSlug(name)
          : undefined;

    if (slug !== undefined) {
      await this.ensureUniqueSlug(slug, id);
    }

    const data: Prisma.ExamUpdateInput = {};

    if (name !== undefined) {
      data.name = name;
    }

    if (slug !== undefined) {
      data.slug = slug;
    }

    if (dto.examType !== undefined) {
      data.examType = dto.examType.trim() || null;
    }

    if (dto.description !== undefined) {
      data.description = dto.description.trim() || null;
    }

    if (dto.institutionId !== undefined) {
      data.institution = dto.institutionId
        ? { connect: { id: dto.institutionId } }
        : { disconnect: true };
    }

    try {
      const exam = await this.prisma.exam.update({
        where: { id },
        data,
        include: {
          institution: true,
          _count: {
            select: {
              occurrences: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Exam updated successfully.',
        data: exam,
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Exam slug already exists.');
      }

      throw error;
    }
  }

  async remove(id: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            occurrences: true,
          },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException('Exam not found.');
    }

    if (exam._count.occurrences > 0) {
      throw new BadRequestException(
        'Cannot delete exam because it has associated question occurrences.',
      );
    }

    await this.prisma.exam.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Exam deleted successfully.',
    };
  }

  private isValidUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}