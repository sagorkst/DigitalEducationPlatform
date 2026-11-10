import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';
import { PermissionsGuard } from './permissions.guard';

@Module({
  imports: [AuthModule],
  controllers: [RbacController],
  providers: [
    RbacService,
    PermissionsGuard,
  ],
  exports: [PermissionsGuard],
})
export class RbacModule {}