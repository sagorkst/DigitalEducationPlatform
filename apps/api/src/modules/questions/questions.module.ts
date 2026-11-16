import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';

import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { QuestionsBulkService } from './questions-bulk.service';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [QuestionsController],
  providers: [QuestionsService, QuestionsBulkService],
  exports: [QuestionsService, QuestionsBulkService],
})
export class QuestionsModule {}