
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';
import { PermissionsGuard } from './permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({
  imports: [
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
  controllers: [RbacController],
  providers: [RbacService, PermissionsGuard, JwtAuthGuard],
})
export class RbacModule {}
