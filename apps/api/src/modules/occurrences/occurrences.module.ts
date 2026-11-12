
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';

import { OccurrencesController } from './occurrences.controller';
import { OccurrencesService } from './occurrences.service';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [OccurrencesController],
  providers: [OccurrencesService],
})
export class OccurrencesModule {}
