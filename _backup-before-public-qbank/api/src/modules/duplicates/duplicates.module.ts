
import { Module } from '@nestjs/common';

import { DuplicatesController } from './duplicates.controller';
import { DuplicatesService } from './duplicates.service';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [DuplicatesController],
  providers: [DuplicatesService],
  exports: [DuplicatesService],
})
export class DuplicatesModule {}
