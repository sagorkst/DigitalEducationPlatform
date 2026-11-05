
import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // GENERATE SLUG
  // ==========================================

  private generateSlug(name: string): string {
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '');

    if (!slug) {
      throw new BadRequestException(
        'Subject name cannot generate a valid slug.',
      );
    }

    return slug;
  }

  // ==========================================
  // CREATE SUBJECT
  // ==========================================

  async create(dto: CreateSubjectDto) {
    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException('Subject name cannot be empty.');
    }

    const existing = await this.prisma.subject.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'A subject with this name already exists.',
      );
    }

    const slug = this.generateSlug(name);

    const existingSlug = await this.prisma.subject.findUnique({
      where: { slug },
    });

    if (existingSlug) {
      throw new ConflictException(
        'A subject with this slug already exists.',
      );
    }

    try {
      const subject = await this.prisma.subject.create({
        data: {
          name,
          slug,
          description: dto.description?.trim() || null,
          isActive: dto.isActive ?? true,
        },
        include: {
          _count: {
            select: {
              topics: true,
              questions: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Subject created successfully.',
        data: subject,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A subject with this name or slug already exists.',
        );
      }

      throw error;
    }
  }

  // ==========================================
  // GET ALL SUBJECTS
  // SEARCH + FILTER + PAGINATION
  // ==========================================

  async findAll(query: {
    page?: string;
    limit?: string;
    search?: string;
    isActive?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(query.limit) || 20),
    );

    const skip = (page - 1) * limit;

    const where: Prisma.SubjectWhereInput = {};

    if (query.search?.trim()) {
      const search = query.search.trim();

      where.OR = [
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
      ];
    }

    if (query.isActive !== undefined) {
      if (!['true', 'false'].includes(query.isActive)) {
        throw new BadRequestException(
          'isActive must be either true or false.',
        );
      }

      where.isActive = query.isActive === 'true';
    }

    const [subjects, total] = await this.prisma.$transaction([
      this.prisma.subject.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          name: 'asc',
        },
        include: {
          _count: {
            select: {
              topics: true,
              questions: true,
            },
          },
        },
      }),
      this.prisma.subject.count({ where }),
    ]);

    return {
      success: true,
      data: subjects,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  // ==========================================
  // GET SUBJECT BY ID
  // ==========================================

  async findOne(id: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      include: {
        topics: {
          where: {
            parentId: null,
          },
          orderBy: {
            name: 'asc',
          },
          include: {
            children: {
              orderBy: {
                name: 'asc',
              },
            },
          },
        },
        _count: {
          select: {
            topics: true,
            questions: true,
          },
        },
      },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found.');
    }

    return {
      success: true,
      data: subject,
    };
  }

  // ==========================================
  // UPDATE SUBJECT
  // ==========================================

  async update(id: string, dto: UpdateSubjectDto) {
    const existing = await this.prisma.subject.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Subject not found.');
    }

    const updateData: Prisma.SubjectUpdateInput = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();

      if (!name) {
        throw new BadRequestException(
          'Subject name cannot be empty.',
        );
      }

      const duplicate = await this.prisma.subject.findFirst({
        where: {
          id: { not: id },
          name: {
            equals: name,
            mode: 'insensitive',
          },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          'A subject with this name already exists.',
        );
      }

      const slug = this.generateSlug(name);

      const duplicateSlug = await this.prisma.subject.findFirst({
        where: {
          id: { not: id },
          slug,
        },
      });

      if (duplicateSlug) {
        throw new ConflictException(
          'A subject with this slug already exists.',
        );
      }

      updateData.name = name;
      updateData.slug = slug;
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description.trim() || null;
    }

    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException(
        'At least one field is required for update.',
      );
    }

    try {
      const updated = await this.prisma.subject.update({
        where: { id },
        data: updateData,
        include: {
          _count: {
            select: {
              topics: true,
              questions: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Subject updated successfully.',
        data: updated,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A subject with this name or slug already exists.',
        );
      }

      throw error;
    }
  }

  // ==========================================
  // DELETE SUBJECT
  // ==========================================

  async remove(id: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            topics: true,
            questions: true,
          },
        },
      },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found.');
    }

    if (
      subject._count.topics > 0 ||
      subject._count.questions > 0
    ) {
      throw new BadRequestException(
        'Cannot delete this subject because topics or questions are associated with it.',
      );
    }

    await this.prisma.subject.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Subject deleted successfully.',
      data: {
        id: subject.id,
        name: subject.name,
      },
    };
  }
}
