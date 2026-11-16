import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AvatarService } from './avatar.service';
import { LocalStorageService } from './local-storage.service';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    AvatarService,
    LocalStorageService,
  ],
})
export class UsersModule {}
