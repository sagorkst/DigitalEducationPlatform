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
import { VerificationService } from '../users/verification.service';

interface RegistrationTokenPayload {
  sub: string;
  email: string;
  purpose: 'registration_email_verification';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly verificationService: VerificationService,
  ) {}

  private async verifyRegistrationToken(
    token: string,
  ): Promise<RegistrationTokenPayload> {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('Registration token required.');
    }

    try {
      const payload =
        await this.jwtService.verifyAsync<RegistrationTokenPayload>(token);

      if (
        !payload.sub ||
        !payload.email ||
        payload.purpose !== 'registration_email_verification'
      ) {
        throw new UnauthorizedException(
          'Invalid registration verification token.',
        );
      }

      return payload;
    } catch {
      throw new UnauthorizedException(
        'Registration token is invalid or expired. Please register again.',
      );
    }
  }

  async register(dto: RegisterDto) {
    const name = dto.name.trim();
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone.trim();

    const existingEmail = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingEmail) {
      throw new ConflictException(
        'An account with this email already exists.',
      );
    }

    const existingPhone = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    });

    if (existingPhone) {
      throw new ConflictException(
        'An account with this phone number already exists.',
      );
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
            accountType: dto.accountType,
            status: 'PENDING',
            emailVerified: false,
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
            accountType: true,
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

      const registrationToken = await this.jwtService.signAsync(
        {
          sub: user.id,
          email: user.email,
          purpose: 'registration_email_verification',
        },
        { expiresIn: '30m' },
      );

      let otpSent = true;
      let otpMessage =
        'Verification code has been sent to your email address.';

      try {
        await this.verificationService.requestRegistrationEmailVerification(
          user.id,
        );
      } catch {
        otpSent = false;
        otpMessage =
          'Account created, but email delivery failed. Use resend verification to try again.';
      }

      const { userRoles, ...profile } = user;

      return {
        success: true,
        message: otpMessage,
        data: {
          user: profile,
          roles: userRoles.map((item) => item.role.name),
          registrationToken,
          otpSent,
          expiresInMinutes: 10,
          registrationTokenExpiresInMinutes: 30,
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

  async resendRegistrationVerification(token: string) {
    const payload = await this.verifyRegistrationToken(token);

    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        email: payload.email,
        status: 'PENDING',
        emailVerified: false,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!user) {
      throw new BadRequestException(
        'This registration is no longer awaiting email verification.',
      );
    }

    const result =
      await this.verificationService.requestRegistrationEmailVerification(
        user.id,
      );

    return {
      success: true,
      message: result.message,
      data: {
        expiresInMinutes: result.expiresInMinutes,
        resendAfterSeconds: result.resendAfterSeconds,
      },
    };
  }

  async verifyRegistrationEmail(
    token: string,
    code: string,
    ipAddress?: string,
  ) {
    const payload = await this.verifyRegistrationToken(token);

    const result =
      await this.verificationService.verifyRegistrationEmail(
        payload.sub,
        payload.email,
        code,
        ipAddress,
      );

    return {
      success: true,
      message: 'Email verified successfully. Your account is now active.',
      data: result,
    };
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
        'Please verify your email address before logging in.',
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Your account is not currently active.',
      );
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      ver: user.tokenVersion ?? 0,
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
          accountType: user.accountType,
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
        accountType: true,
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