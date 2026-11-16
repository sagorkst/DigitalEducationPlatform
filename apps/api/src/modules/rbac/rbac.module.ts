import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';
import { PermissionsGuard } from './permissions.guard';
import { SuperAdminGuard } from './super-admin.guard';

@Module({
  imports: [AuthModule],
  controllers: [RbacController],
  providers: [
    RbacService,
    PermissionsGuard,
    SuperAdminGuard,
  ],
  exports: [PermissionsGuard, SuperAdminGuard],
})
export class RbacModule {}