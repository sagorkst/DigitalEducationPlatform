import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async logout(userId: string) {
    const result = await this.prisma.user.updateMany({
      where: {
        id: userId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      data: {
        tokenVersion: {
          increment: 1,
        },
      },
    });

    if (result.count !== 1) {
      throw new UnauthorizedException(
        'Unable to end session. Please log in again.',
      );
    }

    return {
      success: true,
      message: 'Logout successful.',
    };
  }
}
