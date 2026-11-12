import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  private makeSlug(name: string): string {
    const slug = name
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    return slug || `tag-${Date.now()}`;
  }

  private handleError(error: unknown): never {
    const code = (error as { code?: string })?.code;

    if (code === 'P2002') {
      throw new ConflictException('Tag name or slug already exists.');
    }

    throw error;
  }

  async create(data: { name: string; slug?: string }) {
    const name = data.name?.trim();

    if (!name) {
      throw new BadRequestException('Tag name is required.');
    }

    try {
      const tag = await this.prisma.questionTag.create({
        data: {
          name,
          slug: data.slug?.trim() || this.makeSlug(name),
        },
      });

      return { success: true, data: tag };
    } catch (error) {
      this.handleError(error);
    }
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const search = query.search?.trim();

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { slug: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [tags, total] = await this.prisma.$transaction([
      this.prisma.questionTag.findMany({
        where,
        include: {
          _count: {
            select: { questions: true },
          },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.questionTag.count({ where }),
    ]);

    return {
      success: true,
      data: tags,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const tag = await this.prisma.questionTag.findUnique({
      where: { id },
      include: {
        _count: {
          select: { questions: true },
        },
      },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found.');
    }

    return { success: true, data: tag };
  }

  async update(
    id: string,
    data: { name?: string; slug?: string },
  ) {
    await this.findOne(id);

    const updateData: { name?: string; slug?: string } = {};

    if (data.name !== undefined) {
      const name = data.name.trim();

      if (!name) {
        throw new BadRequestException('Tag name cannot be empty.');
      }

      updateData.name = name;
    }

    if (data.slug !== undefined) {
      const slug = data.slug.trim();

      if (!slug) {
        throw new BadRequestException('Tag slug cannot be empty.');
      }

      updateData.slug = slug;
    }

    try {
      const tag = await this.prisma.questionTag.update({
        where: { id },
        data: updateData,
      });

      return { success: true, data: tag };
    } catch (error) {
      this.handleError(error);
    }
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.questionTag.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Tag deleted successfully.',
    };
  }

  async assignToQuestion(
    questionId: string,
    data: { tagIds: string[] },
  ) {
    if (!Array.isArray(data.tagIds)) {
      throw new BadRequestException('tagIds must be an array.');
    }

    const tagIds = [...new Set(data.tagIds)];

    const question = await this.prisma.question.findFirst({
      where: {
        id: questionId,
        deletedAt: null,
      },
    });

    if (!question) {
      throw new NotFoundException('Question not found.');
    }

    if (tagIds.length > 0) {
      const existingTags = await this.prisma.questionTag.findMany({
        where: { id: { in: tagIds } },
        select: { id: true },
      });

      if (existingTags.length !== tagIds.length) {
        throw new BadRequestException('One or more tag IDs are invalid.');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.questionTagLink.deleteMany({
        where: { questionId },
      });

      if (tagIds.length > 0) {
        await tx.questionTagLink.createMany({
          data: tagIds.map((tagId) => ({
            questionId,
            tagId,
          })),
        });
      }
    });

    const updatedQuestion = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: {
        tags: {
          include: { tag: true },
        },
      },
    });

    return {
      success: true,
      data: updatedQuestion,
    };
  }

  async searchQuestions(query: {
    page?: number;
    limit?: number;
    search?: string;
    tag?: string;
    tagIds?: string;
    matchMode?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const search = query.search?.trim();
    const tag = query.tag?.trim();
    const tagIds = query.tagIds
      ? [...new Set(query.tagIds.split(',').map((id) => id.trim()).filter(Boolean))]
      : [];

    const conditions: any[] = [];

    if (search) {
      conditions.push({
        questionText: {
          contains: search,
          mode: 'insensitive',
        },
      });
    }

    if (tag) {
      conditions.push({
        tags: {
          some: {
            tag: {
              OR: [
                { name: { contains: tag, mode: 'insensitive' } },
                { slug: { contains: tag, mode: 'insensitive' } },
              ],
            },
          },
        },
      });
    }

    if (tagIds.length > 0) {
      if (query.matchMode?.toUpperCase() === 'ALL') {
        for (const tagId of tagIds) {
          conditions.push({
            tags: {
              some: { tagId },
            },
          });
        }
      } else {
        conditions.push({
          tags: {
            some: {
              tagId: { in: tagIds },
            },
          },
        });
      }
    }

    const where: any = {
      deletedAt: null,
      ...(conditions.length > 0 ? { AND: conditions } : {}),
    };

    const [questions, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        include: {
          options: {
            orderBy: { sortOrder: 'asc' },
          },
          occurrences: true,
          tags: {
            include: { tag: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.question.count({ where }),
    ]);

    return {
      success: true,
      data: questions,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
