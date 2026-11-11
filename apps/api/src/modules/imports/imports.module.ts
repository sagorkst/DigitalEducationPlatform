import { Module } from '@nestjs/common';

import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { ImportsExportService } from './imports-export.service';
import { ImportsRollbackService } from './imports-rollback.service';
import { ImportsErrorReportService } from './imports-error-report.service';
import { OcrService } from './ocr.service';
import { OcrHistoryService } from './ocr-history.service';

import { QuestionsModule } from '../questions/questions.module';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [QuestionsModule, AuthModule, RbacModule],
  controllers: [ImportsController],
  providers: [
    ImportsService,
    ImportsExportService,
    ImportsRollbackService,
    ImportsErrorReportService,
    OcrService,
    OcrHistoryService,
  ],
  exports: [
    ImportsService,
    ImportsExportService,
    ImportsRollbackService,
    ImportsErrorReportService,
    OcrService,
    OcrHistoryService,
  ],
})
export class ImportsModule {}
