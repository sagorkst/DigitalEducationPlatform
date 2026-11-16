import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async listRoles() {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: {
        permissions: {
          include: { permission: true },
        },
        _count: {
          select: {
            userRoles: true,
            memberships: true,
          },
        },
      },
    });
  }

  async createRole(dto: CreateRoleDto) {
    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException('Role name cannot be empty.');
    }

    if (name.toUpperCase() === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'SUPER_ADMIN is a reserved system role.',
      );
    }

    const existing = await this.prisma.role.findUnique({
      where: { name },
    });

    if (existing) {
      throw new ConflictException('This role already exists.');
    }

    try {
      return await this.prisma.role.create({
        data: {
          name,
          description: dto.description?.trim() || null,
        },
      });
    } catch (error) {
      if (this.isPrismaUniqueError(error)) {
        throw new ConflictException('This role already exists.');
      }
      throw error;
    }
  }

  async deleteRole(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            userRoles: true,
            memberships: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    if (role.name === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'SUPER_ADMIN cannot be deleted through the normal API.',
      );
    }

    if (role._count.userRoles > 0 || role._count.memberships > 0) {
      throw new ConflictException(
        'This role is assigned. Remove its assignments before deleting it.',
      );
    }

    await this.prisma.role.delete({ where: { id } });

    return {
      success: true,
      message: 'Role deleted successfully.',
    };
  }

  async listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async createPermission(dto: CreatePermissionDto) {
    const key = dto.key.trim();

    if (!key) {
      throw new BadRequestException('Permission key cannot be empty.');
    }

    const existing = await this.prisma.permission.findUnique({
      where: { key },
    });

    if (existing) {
      throw new ConflictException('This permission already exists.');
    }

    try {
      return await this.prisma.permission.create({
        data: {
          key,
          description: dto.description?.trim() || null,
        },
      });
    } catch (error) {
      if (this.isPrismaUniqueError(error)) {
        throw new ConflictException('This permission already exists.');
      }
      throw error;
    }
  }

  async assignPermission(roleId: string, permissionId: string) {
    const [role, permission] = await Promise.all([
      this.prisma.role.findUnique({ where: { id: roleId } }),
      this.prisma.permission.findUnique({ where: { id: permissionId } }),
    ]);

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    if (!permission) {
      throw new NotFoundException('Permission not found.');
    }

    if (role.name === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'SUPER_ADMIN permissions cannot be changed through the normal API.',
      );
    }

    try {
      await this.prisma.rolePermission.create({
        data: { roleId, permissionId },
      });
    } catch (error) {
      if (this.isPrismaUniqueError(error)) {
        throw new ConflictException(
          'This permission is already assigned to the role.',
        );
      }
      throw error;
    }

    return {
      success: true,
      message: 'Permission assigned successfully.',
    };
  }

  async removePermission(roleId: string, permissionId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, name: true },
    });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    if (role.name === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'SUPER_ADMIN permissions cannot be changed through the normal API.',
      );
    }

    const result = await this.prisma.rolePermission.deleteMany({
      where: { roleId, permissionId },
    });

    if (!result.count) {
      throw new NotFoundException('Role-permission relation not found.');
    }

    return {
      success: true,
      message: 'Permission removed successfully.',
    };
  }

  async assignRole(userId: string, roleId: string) {
    const [user, role] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          id: userId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { id: true },
      }),
      this.prisma.role.findUnique({
        where: { id: roleId },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('Active user not found.');
    }

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    if (role.name === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'SUPER_ADMIN cannot be assigned through the normal API.',
      );
    }

    try {
      await this.prisma.userRole.create({
        data: { userId, roleId },
      });
    } catch (error) {
      if (this.isPrismaUniqueError(error)) {
        throw new ConflictException(
          'This role is already assigned to the user.',
        );
      }
      throw error;
    }

    return {
      success: true,
      message: 'Role assigned to user successfully.',
    };
  }

  async removeRole(userId: string, roleId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    if (role.name === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'SUPER_ADMIN cannot be removed through the normal API.',
      );
    }

    const result = await this.prisma.userRole.deleteMany({
      where: { userId, roleId },
    });

    if (!result.count) {
      throw new NotFoundException('This role is not assigned to the user.');
    }

    return {
      success: true,
      message: 'Role removed from user successfully.',
    };
  }

  private isPrismaUniqueError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}