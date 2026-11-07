import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async listAuditLogs(dto: ListAuditLogsDto) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (dto.actorId) {
      where.actorId = dto.actorId;
    }

    if (dto.action?.trim()) {
      where.action = {
        contains: dto.action.trim(),
        mode: 'insensitive',
      };
    }

    if (dto.entityType?.trim()) {
      where.entityType = {
        contains: dto.entityType.trim(),
        mode: 'insensitive',
      };
    }

    if (dto.entityId?.trim()) {
      where.entityId = dto.entityId.trim();
    }

    if (dto.from || dto.to) {
      const createdAt: any = {};

      if (dto.from) {
        createdAt.gte = new Date(dto.from);
      }

      if (dto.to) {
        createdAt.lte = new Date(dto.to);
      }

      if (
        createdAt.gte &&
        createdAt.lte &&
        createdAt.gte > createdAt.lte
      ) {
        throw new BadRequestException(
          'The from date cannot be later than the to date.',
        );
      }

      where.createdAt = createdAt;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        select: {
          id: true,
          actorId: true,
          action: true,
          entityType: true,
          entityId: true,
          createdAt: true,
          actor: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }
}
