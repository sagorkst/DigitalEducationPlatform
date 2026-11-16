import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { LocalStorageService } from './local-storage.service';

@Injectable()
export class AvatarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalStorageService,
  ) {}

  async uploadMyAvatar(userId: string, buffer: Buffer) {
    const current = await this.prisma.user.findFirst({
      where: {
        id: userId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        id: true,
        avatar: true,
      },
    });

    if (!current) {
      throw new NotFoundException('User not found.');
    }

    const newAvatar = await this.storage.saveAvatar(buffer);

    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { avatar: newAvatar },
        select: {
          id: true,
          avatar: true,
          updatedAt: true,
        },
      });

      await this.storage
        .deleteAvatar(current.avatar)
        .catch(() => undefined);

      return {
        success: true,
        message: 'Profile photo uploaded successfully.',
        data: user,
      };
    } catch (error) {
      await this.storage
        .deleteAvatar(newAvatar)
        .catch(() => undefined);

      throw error;
    }
  }

  async removeMyAvatar(userId: string) {
    const current = await this.prisma.user.findFirst({
      where: {
        id: userId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        id: true,
        avatar: true,
      },
    });

    if (!current) {
      throw new NotFoundException('User not found.');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: null },
      select: {
        id: true,
        avatar: true,
        updatedAt: true,
      },
    });

    await this.storage
      .deleteAvatar(current.avatar)
      .catch(() => undefined);

    return {
      success: true,
      message: 'Profile photo removed successfully.',
      data: user,
    };
  }
}
