
import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  private generateSlug(value: string): string {
    return value
      .normalize('NFKD')
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async ensureUniqueSlug(
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.post.findFirst({
      where: {
        slug: {
          equals: slug,
          mode: 'insensitive',
        },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'A post with this slug already exists.',
      );
    }
  }

  async create(dto: CreatePostDto) {
    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException('Post name cannot be empty.');
    }

    const existingName = await this.prisma.post.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });

    if (existingName) {
      throw new ConflictException(
        'A post with this name already exists.',
      );
    }

    const slug = (
      dto.slug?.trim()
        ? this.generateSlug(dto.slug)
        : this.generateSlug(name)
    );

    if (!slug) {
      throw new BadRequestException(
        'A valid slug could not be generated.',
      );
    }

    await this.ensureUniqueSlug(slug);

    try {
      const post = await this.prisma.post.create({
        data: {
          name,
          slug,
          description: dto.description?.trim() || null,
        },
        include: {
          _count: {
            select: { occurrences: true },
          },
        },
      });

      return {
        success: true,
        message: 'Post created successfully.',
        data: post,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A post with this name or slug already exists.',
        );
      }

      throw error;
    }
  }

  async findAll(query: {
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const search = query.search?.trim();

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(query.limit) || 20),
    );

    const where: Prisma.PostWhereInput = search
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
      : {};

    const [data, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: { occurrences: true },
          },
        },
      }),

      this.prisma.post.count({ where }),
    ]);

    return {
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        occurrences: {
          orderBy: [
            { examYear: 'desc' },
            { createdAt: 'desc' },
          ],
          take: 50,
        },
        _count: {
          select: { occurrences: true },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    return {
      success: true,
      data: post,
    };
  }

  async update(id: string, dto: UpdatePostDto) {
    if (
      dto.name === undefined &&
      dto.slug === undefined &&
      dto.description === undefined
    ) {
      throw new BadRequestException(
        'At least one field is required for update.',
      );
    }

    const existing = await this.prisma.post.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Post not found.');
    }

    const data: Prisma.PostUpdateInput = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();

      if (!name) {
        throw new BadRequestException(
          'Post name cannot be empty.',
        );
      }

      const duplicateName = await this.prisma.post.findFirst({
        where: {
          name: {
            equals: name,
            mode: 'insensitive',
          },
          id: { not: id },
        },
        select: { id: true },
      });

      if (duplicateName) {
        throw new ConflictException(
          'A post with this name already exists.',
        );
      }

      data.name = name;
    }

    if (dto.slug !== undefined || dto.name !== undefined) {
      const slug = dto.slug !== undefined
        ? this.generateSlug(dto.slug)
        : this.generateSlug(dto.name!.trim());

      if (!slug) {
        throw new BadRequestException(
          'A valid slug could not be generated.',
        );
      }

      await this.ensureUniqueSlug(slug, id);
      data.slug = slug;
    }

    if (dto.description !== undefined) {
      data.description = dto.description.trim() || null;
    }

    try {
      const updated = await this.prisma.post.update({
        where: { id },
        data,
        include: {
          _count: {
            select: { occurrences: true },
          },
        },
      });

      return {
        success: true,
        message: 'Post updated successfully.',
        data: updated,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A post with this name or slug already exists.',
        );
      }

      throw error;
    }
  }

  async remove(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        _count: {
          select: { occurrences: true },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    if (post._count.occurrences > 0) {
      throw new BadRequestException(
        'Cannot delete this post because it is linked to question occurrences.',
      );
    }

    await this.prisma.post.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Post deleted successfully.',
    };
  }
}
