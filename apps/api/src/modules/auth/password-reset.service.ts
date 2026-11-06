import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PasswordResetService {
  private readonly expiryMinutes = 30;
  private readonly cooldownSeconds = 60;
  private readonly hourlyLimit = 5;

  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getTransporter() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass || !Number.isInteger(port)) {
      throw new ServiceUnavailableException(
        'Email SMTP configuration is incomplete.',
      );
    }

    return nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user,
        pass: pass.replace(/\s/g, ''),
      },
    });
  }

  private genericResponse() {
    return {
      success: true,
      message:
        'If an eligible account exists, a password reset link has been sent.',
    };
  }

  async requestPasswordReset(emailInput: string) {
    const email = emailInput.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: {
        email,
        emailVerified: true,
        status: 'ACTIVE',
        deletedAt: null,
        passwordHash: { not: null },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!user || !user.email) {
      return this.genericResponse();
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [recentCount, latestToken] = await Promise.all([
      this.prisma.passwordResetToken.count({
        where: {
          userId: user.id,
          createdAt: { gte: oneHourAgo },
        },
      }),
      this.prisma.passwordResetToken.findFirst({
        where: {
          userId: user.id,
          consumedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (recentCount >= this.hourlyLimit) {
      return this.genericResponse();
    }

    if (
      latestToken &&
      now.getTime() - latestToken.createdAt.getTime() <
        this.cooldownSeconds * 1000
    ) {
      return this.genericResponse();
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(
      now.getTime() + this.expiryMinutes * 60 * 1000,
    );

    const record = await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          consumedAt: null,
        },
        data: { consumedAt: now },
      });

      return tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });
    });

    try {
      const frontendUrl = (
        process.env.FRONTEND_URL || 'http://localhost:3000'
      ).replace(/\/+$/, '');
      const resetUrl =
        `${frontendUrl}/reset-password?token=` +
        encodeURIComponent(rawToken);

      await this.getTransporter().sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: user.email,
        subject: 'Shikhasetu Password Reset',
        text:
          `Hello ${user.name},\n\n` +
          `We received a request to reset your Shikhasetu password.\n\n` +
          `Use this link to reset your password:\n${resetUrl}\n\n` +
          `This link expires in 30 minutes and can only be used once.\n` +
          `If you did not request this, you can ignore this email.`,
      });
    } catch {
      await this.prisma.passwordResetToken.updateMany({
        where: {
          id: record.id,
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });

      return this.genericResponse();
    }

    return this.genericResponse();
  }

  async resetPassword(
    token: string,
    newPassword: string,
    ipAddress?: string,
  ) {
    const tokenHash = this.hashToken(token);
    const now = new Date();

    const record = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      include: {
        user: {
          select: {
            id: true,
            status: true,
            deletedAt: true,
          },
        },
      },
    });

    if (
      !record ||
      !record.user ||
      record.user.status !== 'ACTIVE' ||
      record.user.deletedAt !== null
    ) {
      throw new BadRequestException(
        'Reset link is invalid, expired, or already used.',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    const completed = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          id: record.id,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });

      if (claimed.count !== 1) {
        return false;
      }

      const updated = await tx.user.updateMany({
        where: {
          id: record.userId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        return false;
      }

      await tx.passwordResetToken.updateMany({
        where: {
          userId: record.userId,
          id: { not: record.id },
          consumedAt: null,
        },
        data: { consumedAt: now },
      });

      await tx.auditLog.create({
        data: {
          actorId: record.userId,
          action: 'PASSWORD_RESET_COMPLETED',
          entityType: 'USER',
          entityId: record.userId,
          details: { method: 'EMAIL' },
          ipAddress: ipAddress || null,
        },
      });

      return true;
    });

    if (!completed) {
      throw new BadRequestException(
        'Reset link is invalid, expired, or already used.',
      );
    }

    return {
      success: true,
      message:
        'Password reset successful. Please log in with your new password.',
    };
  }
}