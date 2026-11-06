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
      throw new BadRequestException('Role name ফাঁকা রাখা যাবে না।');
    }

    const existing = await this.prisma.role.findUnique({
      where: { name },
    });

    if (existing) {
      throw new ConflictException('এই Role আগে থেকেই রয়েছে।');
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
        throw new ConflictException('এই Role আগে থেকেই রয়েছে।');
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
      throw new NotFoundException('Role পাওয়া যায়নি।');
    }

    if (role.name === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'SUPER_ADMIN Role সাধারণ API দিয়ে মুছে ফেলা যাবে না।',
      );
    }

    if (
      role._count.userRoles > 0 ||
      role._count.memberships > 0
    ) {
      throw new ConflictException(
        'এই Role ব্যবহারকারীর সঙ্গে যুক্ত আছে। আগে Role সরাতে হবে।',
      );
    }

    await this.prisma.role.delete({ where: { id } });

    return {
      success: true,
      message: 'Role মুছে ফেলা হয়েছে।',
    };
  }

  async listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async createPermission(dto: CreatePermissionDto) {
    const key = dto.key.trim();

    const existing = await this.prisma.permission.findUnique({
      where: { key },
    });

    if (existing) {
      throw new ConflictException('এই Permission আগে থেকেই রয়েছে।');
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
        throw new ConflictException('এই Permission আগে থেকেই রয়েছে।');
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
      throw new NotFoundException('Role পাওয়া যায়নি।');
    }

    if (!permission) {
      throw new NotFoundException('Permission পাওয়া যায়নি।');
    }

    try {
      await this.prisma.rolePermission.create({
        data: { roleId, permissionId },
      });
    } catch (error) {
      if (this.isPrismaUniqueError(error)) {
        throw new ConflictException('Permission আগে থেকেই যুক্ত আছে।');
      }
      throw error;
    }

    return {
      success: true,
      message: 'Permission যুক্ত হয়েছে।',
    };
  }

  async removePermission(roleId: string, permissionId: string) {
    const result = await this.prisma.rolePermission.deleteMany({
      where: { roleId, permissionId },
    });

    if (!result.count) {
      throw new NotFoundException('Role-Permission সম্পর্ক পাওয়া যায়নি।');
    }

    return {
      success: true,
      message: 'Permission সরানো হয়েছে।',
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
      throw new NotFoundException('সক্রিয় User পাওয়া যায়নি।');
    }

    if (!role) {
      throw new NotFoundException('Role পাওয়া যায়নি।');
    }

    if (role.name === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'SUPER_ADMIN Role সাধারণ API দিয়ে Assign করা যাবে না।',
      );
    }

    try {
      await this.prisma.userRole.create({
        data: { userId, roleId },
      });
    } catch (error) {
      if (this.isPrismaUniqueError(error)) {
        throw new ConflictException('এই Role User-কে আগে থেকেই দেওয়া আছে।');
      }
      throw error;
    }

    return {
      success: true,
      message: 'User-এর সঙ্গে Role যুক্ত হয়েছে।',
    };
  }

  async removeRole(userId: string, roleId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('Role পাওয়া যায়নি।');
    }

    if (role.name === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'SUPER_ADMIN Role সাধারণ API দিয়ে সরানো যাবে না।',
      );
    }

    const result = await this.prisma.userRole.deleteMany({
      where: { userId, roleId },
    });

    if (!result.count) {
      throw new NotFoundException('User-এর সঙ্গে এই Role যুক্ত নেই।');
    }

    return {
      success: true,
      message: 'User থেকে Role সরানো হয়েছে।',
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