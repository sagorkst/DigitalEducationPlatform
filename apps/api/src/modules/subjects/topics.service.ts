
import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

import { CreateTopicDto } from './dto/topics/create-topic.dto';
import { UpdateTopicDto } from './dto/topics/update-topic.dto';

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================
  // UUID VALIDATION
  // =========================================

  private isValidUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  // =========================================
  // SLUG GENERATOR
  // =========================================

  private generateSlug(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '');
  }

  // =========================================
  // DUPLICATE NAME CHECK
  // =========================================

  private async checkDuplicateName(
    subjectId: string,
    name: string,
    excludeId?: string,
  ) {
    const duplicate = await this.prisma.topic.findFirst({
      where: {
        subjectId,
        name: {
          equals: name.trim(),
          mode: 'insensitive',
        },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (duplicate) {
      throw new ConflictException(
        'A topic with this name already exists in this subject.',
      );
    }
  }

  // =========================================
  // VALIDATE SUBJECT
  // =========================================

  private async validateSubject(subjectId: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found.');
    }

    if (!subject.isActive) {
      throw new BadRequestException(
        'Cannot create or move a topic under an inactive subject.',
      );
    }

    return subject;
  }

  // =========================================
  // VALIDATE PARENT TOPIC
  // =========================================

  private async validateParent(
    parentId: string | null | undefined,
    subjectId: string,
    currentTopicId?: string,
  ) {
    if (parentId === null || parentId === undefined) {
      return null;
    }

    const parent = await this.prisma.topic.findUnique({
      where: { id: parentId },
    });

    if (!parent) {
      throw new NotFoundException('Parent topic not found.');
    }

    if (parent.subjectId !== subjectId) {
      throw new BadRequestException(
        'Parent topic must belong to the same subject.',
      );
    }

    if (!parent.isActive) {
      throw new BadRequestException(
        'Cannot use an inactive topic as a parent.',
      );
    }

    if (currentTopicId) {
      let ancestorId: string | null = parent.id;

      while (ancestorId) {
        if (ancestorId === currentTopicId) {
          throw new BadRequestException(
            'Circular topic hierarchy is not allowed.',
          );
        }

        const ancestor: { parentId: string | null } | null =
          await this.prisma.topic.findUnique({
            where: { id: ancestorId },
            select: { parentId: true },
          });

        ancestorId = ancestor?.parentId ?? null;
      }
    }

    return parent;
  }

  // =========================================
  // CREATE TOPIC
  // =========================================

  async create(dto: CreateTopicDto) {
    const subjectId = dto.subjectId;
    const name = dto.name.trim();
    const slug = this.generateSlug(name);

    if (!slug) {
      throw new BadRequestException(
        'Topic name must contain valid characters.',
      );
    }

    await this.validateSubject(subjectId);
    await this.checkDuplicateName(subjectId, name);
    await this.validateParent(dto.parentId, subjectId);

    try {
      const topic = await this.prisma.topic.create({
        data: {
          subjectId,
          parentId: dto.parentId ?? null,
          name,
          slug,
          description: dto.description?.trim() || null,
          isActive: dto.isActive ?? true,
        },
        include: {
          subject: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          parent: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              children: true,
              questions: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Topic created successfully.',
        data: topic,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A topic with this slug already exists in this subject.',
        );
      }

      throw error;
    }
  }

  // =========================================
  // GET ALL TOPICS
  // =========================================

  async findAll(query: {
    page?: string;
    limit?: string;
    search?: string;
    subjectId?: string;
    parentId?: string;
    isActive?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(query.limit) || 20),
    );

    const skip = (page - 1) * limit;

    if (query.subjectId && !this.isValidUuid(query.subjectId)) {
      throw new BadRequestException('Invalid subjectId.');
    }

    if (
      query.parentId &&
      query.parentId !== 'null' &&
      !this.isValidUuid(query.parentId)
    ) {
      throw new BadRequestException('Invalid parentId.');
    }

    let isActive: boolean | undefined;

    if (query.isActive !== undefined) {
      if (!['true', 'false'].includes(query.isActive)) {
        throw new BadRequestException(
          'isActive must be either true or false.',
        );
      }

      isActive = query.isActive === 'true';
    }

    const where: Prisma.TopicWhereInput = {
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.parentId
        ? {
            parentId:
              query.parentId === 'null' ? null : query.parentId,
          }
        : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(query.search
        ? {
            OR: [
              {
                name: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                slug: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [topics, total] = await this.prisma.$transaction([
      this.prisma.topic.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          name: 'asc',
        },
        include: {
          subject: {
            select: {
              id: true,
              name: true,
            },
          },
          parent: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              children: true,
              questions: true,
            },
          },
        },
      }),
      this.prisma.topic.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: topics,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  // =========================================
  // GET TOPIC DETAILS
  // =========================================

  async findOne(id: string) {
    if (!this.isValidUuid(id)) {
      throw new BadRequestException('Invalid topic ID.');
    }

    const topic = await this.prisma.topic.findUnique({
      where: { id },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        children: {
          orderBy: {
            name: 'asc',
          },
        },
        _count: {
          select: {
            children: true,
            questions: true,
          },
        },
      },
    });

    if (!topic) {
      throw new NotFoundException('Topic not found.');
    }

    return {
      success: true,
      data: topic,
    };
  }

  // =========================================
  // UPDATE TOPIC
  // =========================================

  async update(id: string, dto: UpdateTopicDto) {
    if (!this.isValidUuid(id)) {
      throw new BadRequestException('Invalid topic ID.');
    }

    const existing = await this.prisma.topic.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            children: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Topic not found.');
    }

    const hasUpdate =
      dto.subjectId !== undefined ||
      dto.parentId !== undefined ||
      dto.name !== undefined ||
      dto.description !== undefined ||
      dto.isActive !== undefined;

    if (!hasUpdate) {
      throw new BadRequestException(
        'At least one field is required for update.',
      );
    }

    const subjectId = dto.subjectId ?? existing.subjectId;

    if (dto.subjectId !== undefined) {
      await this.validateSubject(subjectId);

      if (
        subjectId !== existing.subjectId &&
        existing._count.children > 0
      ) {
        throw new BadRequestException(
          'Cannot move a topic to another subject while it has subtopics.',
        );
      }
    }

    if (dto.name !== undefined) {
      const name = dto.name.trim();

      if (!name) {
        throw new BadRequestException(
          'Topic name cannot be empty.',
        );
      }

      await this.checkDuplicateName(subjectId, name, id);
    }

    const parentId =
      dto.parentId !== undefined
        ? dto.parentId
        : existing.parentId;

    if (dto.subjectId !== undefined || dto.parentId !== undefined) {
      await this.validateParent(parentId, subjectId, id);
    }

    if (dto.isActive === false && existing.isActive) {
      const activeChildren = await this.prisma.topic.count({
        where: {
          parentId: id,
          isActive: true,
        },
      });

      if (activeChildren > 0) {
        throw new BadRequestException(
          'Cannot deactivate a topic that has active subtopics.',
        );
      }
    }

    const newName = dto.name?.trim() ?? existing.name;
    const newSlug = this.generateSlug(newName);

    if (!newSlug) {
      throw new BadRequestException(
        'Topic name must contain valid characters.',
      );
    }

    try {
      const topic = await this.prisma.topic.update({
        where: { id },
        data: {
          subjectId:
            dto.subjectId !== undefined ? subjectId : undefined,
          parentId:
            dto.parentId !== undefined ? dto.parentId : undefined,
          name: dto.name !== undefined ? newName : undefined,
          slug: dto.name !== undefined ? newSlug : undefined,
          description:
            dto.description !== undefined
              ? dto.description.trim() || null
              : undefined,
          isActive: dto.isActive,
        },
        include: {
          subject: {
            select: {
              id: true,
              name: true,
            },
          },
          parent: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              children: true,
              questions: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Topic updated successfully.',
        data: topic,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A topic with this slug already exists in this subject.',
        );
      }

      throw error;
    }
  }

  // =========================================
  // DELETE TOPIC
  // =========================================

  async remove(id: string) {
    if (!this.isValidUuid(id)) {
      throw new BadRequestException('Invalid topic ID.');
    }

    const topic = await this.prisma.topic.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            children: true,
            questions: true,
          },
        },
      },
    });

    if (!topic) {
      throw new NotFoundException('Topic not found.');
    }

    if (topic._count.children > 0) {
      throw new BadRequestException(
        'Cannot delete a topic that has subtopics.',
      );
    }

    if (topic._count.questions > 0) {
      throw new BadRequestException(
        'Cannot delete a topic that has associated questions.',
      );
    }

    await this.prisma.topic.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Topic deleted successfully.',
      data: {
        id,
        name: topic.name,
      },
    };
  }
}
