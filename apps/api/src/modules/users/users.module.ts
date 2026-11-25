import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { StorageModule } from '../storage/storage.module';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AvatarService } from './avatar.service';

@Module({
  imports: [AuthModule, RbacModule, StorageModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    AvatarService,
  ],
})
export class UsersModule {}
