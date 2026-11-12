import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';

import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Module({
  imports: [DatabaseModule, AuthModule, RbacModule],
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}
