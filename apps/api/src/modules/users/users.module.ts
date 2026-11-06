import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { DatabaseModule } from '../../database/database.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { VerificationService } from './verification.service';

@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;

        if (!secret || secret.length < 32) {
          throw new Error(
            'JWT_SECRET must be configured with at least 32 characters.',
          );
        }

        return {
          secret,
          signOptions: {
            expiresIn: (process.env.JWT_EXPIRES_IN || '1d') as any,
          },
        };
      },
    }),
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    VerificationService,
    JwtAuthGuard,
    PermissionsGuard,
  ],
})
export class UsersModule {}
