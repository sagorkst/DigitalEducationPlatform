import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { Prisma, Institution } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';

@Injectable()
export class InstitutionsService {
  constructor(private readonly prisma: PrismaService) {}

  private generateSlug(name: string): string {
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '');

    if (!slug) {
      throw new BadRequestException('Invalid institution name.');
    }

    return slug;
  }

  private isPrismaError(
    error: unknown,
    code: string,
  ): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === code
    );
  }

  async create(dto: CreateInstitutionDto) {
    const name = dto.name.trim();

    const existing = await this.prisma.institution.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'An institution with this name already exists.',
      );
    }

    const slug = this.generateSlug(name);

    try {
      const institution = await this.prisma.institution.create({
        data: {
          name,
          slug,
          type: dto.type?.trim() || null,
          description: dto.description?.trim() || null,
          website: dto.website?.trim() || null,
          isActive: dto.isActive ?? true,
        },
        include: {
          _count: {
            select: {
              exams: true,
              occurrences: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Institution created successfully.',
        data: institution,
      };
    } catch (error: unknown) {
      if (this.isPrismaError(error, 'P2002')) {
        throw new ConflictException('Institution slug already exists.');
      }

      throw error;
    }
  }

  async findAll(query: {
    search?: string;
    type?: string;
    isActive?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    if (
      query.isActive !== undefined &&
      !['true', 'false'].includes(query.isActive)
    ) {
      throw new BadRequestException(
        'isActive must be either true or false.',
      );
    }

    const search = query.search?.trim();

    const where: Prisma.InstitutionWhereInput = {
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
      ...(query.type
        ? {
            type: {
              equals: query.type.trim(),
              mode: 'insensitive',
            },
          }
        : {}),
      ...(query.isActive !== undefined
        ? { isActive: query.isActive === 'true' }
        : {}),
    };

    const [institutions, total] = await Promise.all([
      this.prisma.institution.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          name: 'asc',
        },
        include: {
          _count: {
            select: {
              exams: true,
              occurrences: true,
            },
          },
        },
      }),

      this.prisma.institution.count({ where }),
    ]);

    return {
      success: true,
      data: institutions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { id },
      include: {
        exams: {
          orderBy: {
            name: 'asc',
          },
        },
        _count: {
          select: {
            exams: true,
            occurrences: true,
          },
        },
      },
    });

    if (!institution) {
      throw new NotFoundException('Institution not found.');
    }

    return {
      success: true,
      data: institution,
    };
  }

  async update(id: string, dto: UpdateInstitutionDto) {
    const existing = await this.prisma.institution.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Institution not found.');
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
      throw new BadRequestException(
        'Institution name cannot be empty.',
      );
    }

    if (name && name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await this.prisma.institution.findFirst({
        where: {
          name: {
            equals: name,
            mode: 'insensitive',
          },
          NOT: {
            id,
          },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          'An institution with this name already exists.',
        );
      }
    }

    const data: Prisma.InstitutionUpdateInput = {};

    if (name !== undefined) {
      data.name = name;
      data.slug = this.generateSlug(name);
    }

    if (dto.type !== undefined) {
      data.type = dto.type.trim() || null;
    }

    if (dto.description !== undefined) {
      data.description = dto.description.trim() || null;
    }

    if (dto.website !== undefined) {
      data.website = dto.website.trim() || null;
    }

    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    try {
      const institution = await this.prisma.institution.update({
        where: { id },
        data,
        include: {
          _count: {
            select: {
              exams: true,
              occurrences: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Institution updated successfully.',
        data: institution,
      };
    } catch (error: unknown) {
      if (this.isPrismaError(error, 'P2002')) {
        throw new ConflictException('Institution slug already exists.');
      }

      throw error;
    }
  }

  async remove(id: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            exams: true,
            occurrences: true,
          },
        },
      },
    });

    if (!institution) {
      throw new NotFoundException('Institution not found.');
    }

    if (
      institution._count.exams > 0 ||
      institution._count.occurrences > 0
    ) {
      throw new BadRequestException(
        'Cannot delete institution because it has associated exams or question occurrences. Deactivate it instead.',
      );
    }

    await this.prisma.institution.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Institution deleted successfully.',
    };
  }
}