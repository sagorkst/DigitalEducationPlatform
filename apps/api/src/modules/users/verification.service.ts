import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import * as nodemailer from 'nodemailer';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class VerificationService {
  private readonly expiryMinutes = 10;
  private readonly resendCooldownSeconds = 60;
  private readonly hourlyLimit = 5;
  private readonly maxAttempts = 5;

  constructor(private readonly prisma: PrismaService) {}

  private hashCode(code: string): string {
    const secret = process.env.OTP_SECRET || process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
      throw new ServiceUnavailableException(
        'OTP_SECRET or a valid JWT_SECRET must be configured.',
      );
    }

    return createHmac('sha256', secret).update(code).digest('hex');
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

  private async issueEmailCode(
    userId: string,
    expectedStatus: 'ACTIVE' | 'PENDING',
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        status: expectedStatus,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User account পাওয়া যায়নি।');
    }

    if (!user.email) {
      throw new BadRequestException('Email পাওয়া যায়নি।');
    }

    if (user.emailVerified) {
      throw new ConflictException('Email ইতোমধ্যে verified হয়েছে।');
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [recentCount, latestCode] = await Promise.all([
      this.prisma.verificationCode.count({
        where: {
          userId,
          channel: 'EMAIL',
          createdAt: { gte: oneHourAgo },
        },
      }),
      this.prisma.verificationCode.findFirst({
        where: {
          userId,
          channel: 'EMAIL',
          consumedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (recentCount >= this.hourlyLimit) {
      throw new HttpException(
        'প্রতি ঘণ্টায় সর্বোচ্চ ৫টি OTP request করা যাবে।',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (
      latestCode &&
      now.getTime() - latestCode.createdAt.getTime() <
        this.resendCooldownSeconds * 1000
    ) {
      throw new HttpException(
        'নতুন OTP পাঠানোর আগে ৬০ সেকেন্ড অপেক্ষা করুন।',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = randomInt(0, 1000000).toString().padStart(6, '0');
    const codeHash = this.hashCode(code);
    const expiresAt = new Date(
      now.getTime() + this.expiryMinutes * 60 * 1000,
    );

    const record = await this.prisma.$transaction(async (tx) => {
      await tx.verificationCode.updateMany({
        where: {
          userId,
          channel: 'EMAIL',
          consumedAt: null,
        },
        data: { consumedAt: now },
      });

      return tx.verificationCode.create({
        data: {
          userId,
          channel: 'EMAIL',
          target: user.email!,
          codeHash,
          expiresAt,
        },
      });
    });

    try {
      const transporter = this.getTransporter();

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: user.email,
        subject: 'Shikhasetu Email Verification',
        text:
          `Hello ${user.name},\n\n` +
          `Your Shikhasetu verification code is: ${code}\n\n` +
          `This code expires in 10 minutes. Do not share this code with anyone.`,
      });
    } catch {
      await this.prisma.verificationCode.updateMany({
        where: {
          id: record.id,
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });

      throw new ServiceUnavailableException(
        'Email পাঠানো যায়নি। SMTP configuration পরীক্ষা করুন।',
      );
    }

    return {
      message: 'Verification code email-এ পাঠানো হয়েছে।',
      expiresInMinutes: this.expiryMinutes,
      resendAfterSeconds: this.resendCooldownSeconds,
    };
  }

  async requestEmailVerification(userId: string) {
    return this.issueEmailCode(userId, 'ACTIVE');
  }

  async requestRegistrationEmailVerification(userId: string) {
    return this.issueEmailCode(userId, 'PENDING');
  }

  private async verifyEmailForStatus(
    userId: string,
    expectedEmail: string,
    code: string,
    expectedStatus: 'ACTIVE' | 'PENDING',
    ipAddress?: string,
  ) {
    const record = await this.prisma.verificationCode.findFirst({
      where: {
        userId,
        channel: 'EMAIL',
        target: expectedEmail,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new NotFoundException('Active verification code পাওয়া যায়নি।');
    }

    const now = new Date();

    if (record.expiresAt.getTime() <= now.getTime()) {
      await this.prisma.verificationCode.updateMany({
        where: { id: record.id, consumedAt: null },
        data: { consumedAt: now },
      });

      throw new BadRequestException('Verification code-এর মেয়াদ শেষ।');
    }

    if (record.attempts >= this.maxAttempts) {
      await this.prisma.verificationCode.updateMany({
        where: { id: record.id, consumedAt: null },
        data: { consumedAt: now },
      });

      throw new HttpException(
        'সর্বোচ্চ ভুল চেষ্টা শেষ হয়েছে। নতুন OTP request করুন।',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const expectedHash = Buffer.from(record.codeHash, 'hex');
    const suppliedHash = Buffer.from(this.hashCode(code), 'hex');

    const valid =
      expectedHash.length === suppliedHash.length &&
      timingSafeEqual(expectedHash, suppliedHash);

    if (!valid) {
      await this.prisma.verificationCode.update({
        where: { id: record.id },
        data: {
          attempts: { increment: 1 },
          ...(record.attempts + 1 >= this.maxAttempts
            ? { consumedAt: now }
            : {}),
        },
      });

      throw new UnauthorizedException('Verification code সঠিক নয়।');
    }

    const verified = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.verificationCode.updateMany({
        where: {
          id: record.id,
          consumedAt: null,
          attempts: { lt: this.maxAttempts },
        },
        data: { consumedAt: now },
      });

      if (claimed.count !== 1) {
        return false;
      }

      const currentUser = await tx.user.findFirst({
        where: {
          id: userId,
          email: expectedEmail,
          status: expectedStatus,
          emailVerified: false,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!currentUser) {
        return false;
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          emailVerified: true,
          ...(expectedStatus === 'PENDING'
            ? { status: 'ACTIVE' }
            : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'EMAIL_VERIFIED',
          entityType: 'USER',
          entityId: userId,
          details: {
            email: expectedEmail,
            registrationActivation: expectedStatus === 'PENDING',
          },
          ipAddress: ipAddress || null,
        },
      });

      return true;
    });

    if (!verified) {
      throw new BadRequestException(
        'Email পরিবর্তিত হয়েছে অথবা code ইতোমধ্যে ব্যবহার করা হয়েছে।',
      );
    }

    return {
      message:
        expectedStatus === 'PENDING'
          ? 'Email verified. Account is now active.'
          : 'Email successfully verified.',
      emailVerified: true,
      accountActivated: expectedStatus === 'PENDING',
    };
  }

  async verifyEmail(userId: string, code: string, ipAddress?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      select: { email: true },
    });

    if (!user?.email) {
      throw new NotFoundException('User email পাওয়া যায়নি।');
    }

    return this.verifyEmailForStatus(
      userId,
      user.email,
      code,
      'ACTIVE',
      ipAddress,
    );
  }

  async verifyRegistrationEmail(
    userId: string,
    email: string,
    code: string,
    ipAddress?: string,
  ) {
    return this.verifyEmailForStatus(
      userId,
      email,
      code,
      'PENDING',
      ipAddress,
    );
  }
}