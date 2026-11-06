
import {
  Injectable,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const name = dto.name.trim();
    const email = dto.email?.trim().toLowerCase() || null;
    const phone = dto.phone?.trim() || null;

    if (!email && !phone) {
      throw new BadRequestException(
        'Email or phone number is required.',
      );
    }

    if (email) {
      const existing = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existing) {
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }
    }

    if (phone) {
      const existing = await this.prisma.user.findUnique({
        where: { phone },
        select: { id: true },
      });

      if (existing) {
        throw new ConflictException(
          'An account with this phone number already exists.',
        );
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const defaultRole = await tx.role.findUnique({
          where: { name: 'USER' },
          select: { id: true },
        });

        if (!defaultRole) {
          throw new InternalServerErrorException(
            'Default USER role is missing. Run the database seed first.',
          );
        }

        return tx.user.create({
          data: {
            name,
            email,
            phone,
            passwordHash,
            status: 'PENDING',
            userRoles: {
              create: {
                roleId: defaultRole.id,
              },
            },
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
            createdAt: true,
            userRoles: {
              select: {
                role: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        });
      });

      const { userRoles, ...profile } = user;

      return {
        success: true,
        message:
          'Registration successful. Your account is waiting for approval.',
        data: {
          user: profile,
          roles: userRoles.map((item) => item.role.name),
        },
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Email or phone number is already in use.',
        );
      }

      throw error;
    }
  }

  async login(dto: LoginDto) {
    const identifier = dto.identifier.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { email: identifier },
          { phone: dto.identifier.trim() },
        ],
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException(
        'Invalid email/phone or password.',
      );
    }

    const passwordMatched = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatched) {
      throw new UnauthorizedException(
        'Invalid email/phone or password.',
      );
    }

    if (user.status === 'PENDING') {
      throw new ForbiddenException(
        'Your account is waiting for approval.',
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Your account is not currently active.',
      );
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
    });

    return {
      success: true,
      message: 'Login successful.',
      data: {
        accessToken,
        tokenType: 'Bearer',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          status: user.status,
        },
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        status: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        userRoles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
                permissions: {
                  select: {
                    permission: {
                      select: { key: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const roles = user.userRoles.map((item) => ({
      id: item.role.id,
      name: item.role.name,
    }));

    const permissions = [
      ...new Set(
        user.userRoles.flatMap((item) =>
          item.role.permissions.map(
            (entry) => entry.permission.key,
          ),
        ),
      ),
    ];

    const { userRoles, ...profile } = user;

    return {
      success: true,
      data: {
        user: profile,
        roles,
        permissions,
      },
    };
  }
}
