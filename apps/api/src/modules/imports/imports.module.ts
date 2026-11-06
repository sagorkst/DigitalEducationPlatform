import { Module } from '@nestjs/common';

import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { ImportsExportService } from './imports-export.service';
import { ImportsRollbackService } from './imports-rollback.service';
import { ImportsErrorReportService } from './imports-error-report.service';
import { QuestionsModule } from '../questions/questions.module';

@Module({
  imports: [QuestionsModule],
  controllers: [ImportsController],
  providers: [
    ImportsService,
    ImportsExportService,
    ImportsRollbackService,
    ImportsErrorReportService,
  ],
  exports: [
    ImportsService,
    ImportsExportService,
    ImportsRollbackService,
    ImportsErrorReportService,
  ],
})
export class ImportsModule {}