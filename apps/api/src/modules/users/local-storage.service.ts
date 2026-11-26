import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { basename, resolve, sep } from 'path';
import sharp from 'sharp';

@Injectable()
export class LocalStorageService {
  private readonly storageRoot = resolve(process.cwd(), 'uploads');
  private readonly avatarDirectory = resolve(
    this.storageRoot,
    'avatars',
  );

  async saveAvatar(buffer: Buffer): Promise<string> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('An image file is required.');
    }

    let output: Buffer;

    try {
      const image = sharp(buffer, {
        limitInputPixels: 40_000_000,
        failOn: 'error',
      });

      const metadata = await image.metadata();

      if (
        !metadata.format ||
        !['jpeg', 'png', 'webp'].includes(metadata.format)
      ) {
        throw new BadRequestException(
          'Only JPEG, PNG and WebP images are allowed.',
        );
      }

      if (metadata.pages && metadata.pages > 1) {
        throw new BadRequestException(
          'Animated images are not supported.',
        );
      }

      output = await image
        .rotate()
        .resize(512, 512, {
          fit: 'cover',
          position: 'attention',
          withoutEnlargement: true,
        })
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        'The uploaded file is not a valid supported image.',
      );
    }

    await mkdir(this.avatarDirectory, { recursive: true });

    const filename = `${randomUUID()}.webp`;
    const filePath = resolve(this.avatarDirectory, filename);

    await writeFile(filePath, output, { flag: 'wx' });

    return `/uploads/avatars/${filename}`;
  }

  async saveQuestionImage(buffer: Buffer): Promise<string> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('An image file is required.');
    }

    let output: Buffer;

    try {
      const image = sharp(buffer, {
        limitInputPixels: 40_000_000,
        failOn: 'error',
      });
      const metadata = await image.metadata();

      if (
        !metadata.format ||
        !['jpeg', 'png', 'webp', 'gif', 'svg'].includes(metadata.format)
      ) {
        throw new BadRequestException(
          'Only JPEG, PNG, WebP, GIF and SVG images are allowed.',
        );
      }

      if (metadata.pages && metadata.pages > 1) {
        throw new BadRequestException(
          'Animated images are not supported.',
        );
      }

      // Keep diagrams and option images uncropped; preserve their aspect ratio.
      output = await image
        .rotate()
        .resize(2400, 2400, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 88, effort: 5 })
        .toBuffer();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        'The uploaded file is not a valid supported image.',
      );
    }

    const imageDirectory = resolve(this.storageRoot, 'questions');
    await mkdir(imageDirectory, { recursive: true });

    const filename = `${randomUUID()}.webp`;
    const filePath = resolve(imageDirectory, filename);
    await writeFile(filePath, output, { flag: 'wx' });

    return `/uploads/questions/${filename}`;
  }

  async deleteAvatar(publicPath: string | null | undefined): Promise<void> {
    if (!publicPath) return;

    const filename = basename(publicPath.split('?')[0]);

    if (!/^[a-f0-9-]{36}\.webp$/i.test(filename)) {
      return;
    }

    const target = resolve(this.avatarDirectory, filename);
    const allowedRoot = this.avatarDirectory + sep;

    if (!target.startsWith(allowedRoot)) {
      return;
    }

    try {
      await unlink(target);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return;
      }

      throw error;
    }
  }
}
