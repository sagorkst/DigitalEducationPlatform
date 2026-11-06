import {
  Injectable,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
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
      throw new BadRequestException('Email অথবা phone দিতে হবে।');
    }

    if (email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingEmail) {
        throw new ConflictException('এই email দিয়ে account রয়েছে।');
      }
    }

    if (phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone },
        select: { id: true },
      });

      if (existingPhone) {
        throw new ConflictException('এই phone number দিয়ে account রয়েছে।');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const user = await this.prisma.user.create({
        data: {
          name,
          email,
          phone,
          passwordHash,
          status: 'PENDING',
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
        },
      });

      return {
        success: true,
        message: 'Registration সফল হয়েছে। Account approval-এর অপেক্ষায় রয়েছে।',
        data: { user },
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email অথবা phone number আগে থেকেই ব্যবহৃত হয়েছে।');
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
      throw new UnauthorizedException('ভুল email/phone অথবা password।');
    }

    const passwordMatched = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatched) {
      throw new UnauthorizedException('ভুল email/phone অথবা password।');
    }

    if (user.status === 'PENDING') {
      throw new ForbiddenException('আপনার account এখনো অনুমোদিত হয়নি।');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('আপনার account বর্তমানে সক্রিয় নয়।');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
    });

    return {
      success: true,
      message: 'Login সফল হয়েছে।',
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
        memberships: {
          where: {
            status: 'ACTIVE',
            organization: {
              status: 'ACTIVE',
              deletedAt: null,
            },
          },
          select: {
            id: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            roles: {
              select: {
                role: {
                  select: {
                    id: true,
                    name: true,
                    permissions: {
                      select: {
                        permission: {
                          select: {
                            key: true,
                          },
                        },
                      },
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
      throw new NotFoundException('User পাওয়া যায়নি।');
    }

    const memberships = user.memberships.map((membership) => ({
      id: membership.id,
      organization: membership.organization,
      roles: membership.roles.map((item) => item.role.name),
      permissions: [
        ...new Set(
          membership.roles.flatMap((item) =>
            item.role.permissions.map((permission) => permission.permission.key),
          ),
        ),
      ],
    }));

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          status: user.status,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          createdAt: user.createdAt,
        },
        memberships,
      },
    };
  }
}
