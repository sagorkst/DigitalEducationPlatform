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

  private generateSlug(value: string): string {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '');

    if (!slug) {
      throw new BadRequestException('Invalid exam slug or name.');
    }

    return slug;
  }

  private isValidUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
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

  private async ensurePostExists(postId?: string) {
    if (!postId) {
      return null;
    }

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    return post;
  }

  private async ensureUniqueSlug(slug: string, excludeId?: string) {
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

  private async ensureNoDuplicateExam(params: {
    name: string;
    institutionId: string | null;
    postId: string | null;
    examYear: number;
    examType: string | null;
    excludeId?: string;
  }) {
    const existing = await this.prisma.exam.findFirst({
      where: {
        name: {
          equals: params.name,
          mode: 'insensitive',
        },
        institutionId: params.institutionId,
        postId: params.postId,
        examYear: params.examYear,
        examType: params.examType,
        ...(params.excludeId
          ? {
              NOT: { id: params.excludeId },
            }
          : {}),
      },
    });

    if (existing) {
      throw new ConflictException(
        'এই একই Exam, Institution, Post, Year এবং Exam Type আগে থেকেই যুক্ত আছে।',
      );
    }
  }

  async create(dto: CreateExamDto) {
    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException('Exam name cannot be empty.');
    }

    const institution = await this.ensureInstitutionExists(
      dto.institutionId,
    );

    const post = await this.ensurePostExists(dto.postId);

    const examType = dto.examType?.trim() || null;
    const grade = dto.grade?.trim() || null;

    const slug = dto.slug?.trim()
      ? this.generateSlug(dto.slug)
      : this.generateSlug(name);

    await this.ensureNoDuplicateExam({
      name,
      institutionId: institution?.id ?? null,
      postId: post?.id ?? null,
      examYear: dto.examYear,
      examType,
    });

    await this.ensureUniqueSlug(slug);

    try {
      const exam = await this.prisma.exam.create({
        data: {
          name,
          slug,
          examYear: dto.examYear,
          examType,
          grade,
          description: dto.description?.trim() || null,

          ...(institution
            ? {
                institution: {
                  connect: { id: institution.id },
                },
              }
            : {}),

          ...(post
            ? {
                post: {
                  connect: { id: post.id },
                },
              }
            : {}),
        },
        include: {
          institution: true,
          post: true,
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
        throw new ConflictException(
          'এই Exam-এর তথ্য আগে থেকেই যুক্ত আছে।',
        );
      }

      throw error;
    }
  }

  async findAll(query: {
    search?: string;
    institutionId?: string;
    postId?: string;
    examYear?: number;
    examType?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    if (
      query.institutionId &&
      !this.isValidUuid(query.institutionId)
    ) {
      throw new BadRequestException('Invalid institutionId.');
    }

    if (query.postId && !this.isValidUuid(query.postId)) {
      throw new BadRequestException('Invalid postId.');
    }

    if (
      query.examYear !== undefined &&
      (!Number.isInteger(query.examYear) ||
        query.examYear < 1900 ||
        query.examYear > 2100)
    ) {
      throw new BadRequestException('Invalid examYear.');
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
              {
                examType: {
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

      ...(query.postId ? { postId: query.postId } : {}),

      ...(query.examYear !== undefined
        ? { examYear: query.examYear }
        : {}),

      ...(query.examType?.trim()
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
          { examYear: 'desc' },
          { name: 'asc' },
          { createdAt: 'desc' },
        ],
        include: {
          institution: true,
          post: true,
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
        post: true,
        occurrences: {
          orderBy: {
            createdAt: 'desc',
          },
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
      include: {
        _count: {
          select: {
            occurrences: true,
          },
        },
      },
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
        ? dto.institutionId || null
        : existing.institutionId;

    const postId =
      dto.postId !== undefined
        ? dto.postId || null
        : existing.postId;

    const examYear = dto.examYear ?? existing.examYear;

    const examType =
      dto.examType !== undefined
        ? dto.examType.trim() || null
        : existing.examType;

    const structuralChanges =
      institutionId !== existing.institutionId ||
      postId !== existing.postId ||
      examYear !== existing.examYear;

    if (
      structuralChanges &&
      existing._count.occurrences > 0
    ) {
      throw new BadRequestException(
        'এই Exam-এর সঙ্গে প্রশ্ন যুক্ত আছে। তাই Institution, Post অথবা Exam Year পরিবর্তন করা যাবে না।',
      );
    }

    const finalName = name ?? existing.name;

    const institution = await this.ensureInstitutionExists(
      institutionId ?? undefined,
    );

    const post = await this.ensurePostExists(postId ?? undefined);

    if (
      name !== undefined ||
      dto.institutionId !== undefined ||
      dto.postId !== undefined ||
      dto.examYear !== undefined ||
      dto.examType !== undefined
    ) {
      await this.ensureNoDuplicateExam({
        name: finalName,
        institutionId: institution?.id ?? null,
        postId: post?.id ?? null,
        examYear,
        examType,
        excludeId: id,
      });
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

    if (dto.examYear !== undefined) {
      data.examYear = examYear;
    }

    if (dto.examType !== undefined) {
      data.examType = examType;
    }

    if (dto.grade !== undefined) {
      data.grade = dto.grade.trim() || null;
    }

    if (dto.description !== undefined) {
      data.description = dto.description.trim() || null;
    }

    if (dto.institutionId !== undefined) {
      data.institution = institution
        ? { connect: { id: institution.id } }
        : { disconnect: true };
    }

    if (dto.postId !== undefined) {
      data.post = post
        ? { connect: { id: post.id } }
        : { disconnect: true };
    }

    try {
      const exam = await this.prisma.exam.update({
        where: { id },
        data,
        include: {
          institution: true,
          post: true,
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
        throw new ConflictException(
          'এই Exam-এর তথ্য আগে থেকেই যুক্ত আছে।',
        );
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
}