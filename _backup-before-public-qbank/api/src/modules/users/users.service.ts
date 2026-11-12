import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../../database/prisma.service';
import { ListUsersDto } from './dto/list-users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(dto: ListUsersDto) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;
    const search = dto.search?.trim();

    const where: any = { deletedAt: null };

    if (dto.status) where.status = dto.status;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, phone: true,
          avatar: true, status: true, emailVerified: true,
          phoneVerified: true, createdAt: true, updatedAt: true,
          userRoles: {
            select: { role: { select: { id: true, name: true } } },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((user) => ({
        ...user,
        roles: user.userRoles.map((item) => item.role),
        userRoles: undefined,
      })),
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getUserDetails(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true, name: true, email: true, phone: true,
        avatar: true, status: true, emailVerified: true,
        phoneVerified: true, createdAt: true, updatedAt: true,
        userRoles: {
          select: {
            role: {
              select: { id: true, name: true, description: true },
            },
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found.');

    return {
      ...user,
      roles: user.userRoles.map((item) => item.role),
      userRoles: undefined,
    };
  }

  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: 'ACTIVE', deletedAt: null },
      select: {
        id: true, name: true, email: true, phone: true,
        avatar: true, status: true, emailVerified: true,
        phoneVerified: true, createdAt: true, updatedAt: true,
        userRoles: {
          select: { role: { select: { id: true, name: true } } },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found.');

    return {
      success: true,
      data: {
        ...user,
        roles: user.userRoles.map((item) => item.role),
        userRoles: undefined,
      },
    };
  }

  async updateMyProfile(userId: string, dto: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    avatar?: string | null;
  }) {
    const current = await this.prisma.user.findFirst({
      where: { id: userId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, email: true, phone: true },
    });

    if (!current) throw new NotFoundException('User not found.');

    const data: any = {};

    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.avatar !== undefined) data.avatar = dto.avatar;

    if (dto.email !== undefined) {
      const email = dto.email?.trim().toLowerCase() || null;

      if (!email && !dto.phone && !current.phone) {
        throw new BadRequestException(
          'At least one email or phone number is required.',
        );
      }

      data.email = email;
      if (email !== current.email) data.emailVerified = false;
    }

    if (dto.phone !== undefined) {
      const phone = dto.phone?.trim() || null;

      if (!phone && !dto.email && !current.email) {
        throw new BadRequestException(
          'At least one email or phone number is required.',
        );
      }

      data.phone = phone;
      if (phone !== current.phone) data.phoneVerified = false;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No profile changes provided.');
    }

    if (data.name !== undefined && !data.name) {
      throw new BadRequestException('Name cannot be empty.');
    }

    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data,
        select: {
          id: true, name: true, email: true, phone: true,
          avatar: true, status: true, emailVerified: true,
          phoneVerified: true, updatedAt: true,
        },
      });

      return {
        success: true,
        message: 'Profile updated successfully.',
        data: user,
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email or phone number is already in use.');
      }
      throw error;
    }
  }

  async changeMyPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      throw new NotFoundException('User not found.');
    }

    const matched = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!matched) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'New password must be different from current password.',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
    });

    return {
      success: true,
      message: 'Password changed successfully. Please log in again.',
    };
  }

  async updateUserStatus(
    userId: string,
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
    actorId: string,
    ipAddress?: string,
  ) {
    if (userId === actorId) {
      throw new ForbiddenException(
        'You cannot change your own account status.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId, deletedAt: null },
        include: { userRoles: { include: { role: true } } },
      });

      if (!user) throw new NotFoundException('User not found.');

      if (user.userRoles.some((item) => item.role.name === 'SUPER_ADMIN')) {
        throw new ForbiddenException(
          'SUPER_ADMIN account status cannot be changed through this API.',
        );
      }

      if (user.status === status) {
        throw new BadRequestException(
          'User already has the requested status.',
        );
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { status },
        select: {
          id: true, name: true, email: true, phone: true,
          status: true, updatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'USER_STATUS_UPDATED',
          entityType: 'USER',
          entityId: userId,
          details: {
            previousStatus: user.status,
            newStatus: status,
          },
          ipAddress: ipAddress || null,
        },
      });

      return {
        success: true,
        message: 'User status updated successfully.',
        data: updatedUser,
      };
    });
  }
}