import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Res,
  UseGuards,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import * as XLSX from 'xlsx';

import { ImportsService } from './imports.service';
import { ImportsExportService } from './imports-export.service';
import { ImportsRollbackService } from './imports-rollback.service';
import { ImportsErrorReportService } from './imports-error-report.service';
import { OcrService } from './ocr.service';
import { OcrHistoryService } from './ocr-history.service';
import { CommitImportDto } from './dto/commit-import.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';

@Controller('imports')
export class ImportsController {
  constructor(
    private readonly importsService: ImportsService,
    private readonly exportService: ImportsExportService,
    private readonly rollbackService: ImportsRollbackService,
    private readonly errorReportService: ImportsErrorReportService,
    private readonly ocrService: OcrService,
    private readonly ocrHistoryService: OcrHistoryService,
  ) {}

  @Post('preview')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  preview(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'Please upload a JSON, CSV or XLSX file.',
      );
    }

    return this.importsService.preview(file);
  }

  @Post('ocr/preview')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('content.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  async ocrPreview(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'Please upload a PDF, PNG, JPG or JPEG file.',
      );
    }

    const result = await this.ocrService.extractText(file);
    const parsedQuestions = result.parsedQuestions ?? [];

    const history =
      parsedQuestions.length > 0
        ? await this.ocrHistoryService.createBatch(
            file,
            parsedQuestions as unknown as Record<string, unknown>[],
          )
        : null;

    return {
      ...result,
      history,
    };
  }

  @Put('ocr/history/:batchId/rows/:rowId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('content.manage')
  @HttpCode(HttpStatus.OK)
  async updateOcrHistoryRow(
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @Param('rowId', ParseUUIDPipe) rowId: string,
    @Body()
    body: {
      status: 'PENDING' | 'VALID' | 'INVALID' | 'DUPLICATE' | 'IMPORTED' | 'SKIPPED';
      errorMessages?: unknown;
      questionId?: string | null;
      rawData?: unknown;
    },
  ) {
    return this.ocrHistoryService.updateRow(
      batchId,
      rowId,
      body.status,
      body.errorMessages,
      body.questionId,
      body.rawData,
    );
  }
  @Put('ocr/history/:batchId/progress')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('content.manage')
  @HttpCode(HttpStatus.OK)
  async updateOcrHistoryProgress(
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @Body()
    body: {
      rows: Array<{
        rowId: string;
        status: 'PENDING' | 'VALID' | 'INVALID' | 'DUPLICATE' | 'IMPORTED' | 'SKIPPED';
        errorMessages?: unknown;
        questionId?: string | null;
        rawData: unknown;
      }>;
    },
  ) {
    return this.ocrHistoryService.updateRows(batchId, body.rows);
  }

  @Get('template')
  downloadTemplate(
    @Query('format') format: string = 'xlsx',
    @Res() response: Response,
  ) {
    const normalizedFormat = format.toLowerCase();

    if (!['xlsx', 'csv'].includes(normalizedFormat)) {
      throw new BadRequestException(
        'Template format must be xlsx or csv.',
      );
    }

    const headers = [
      'questionText',
      'subject',
      'topic',
      'questionType',
      'difficulty',
      'status',
      'optionA',
      'optionB',
      'optionC',
      'optionD',
      'optionE',
      'explanation',
      'institution',
      'examName',
      'examYear',
      'postName',
      'department',
      'questionNumber',
      'source',
      'sourcePage',
      'sourceUrl',
      'institutionId',
      'examId',
      'postId',
      'sourceDocumentId',
    ];

    const exampleRow = [
      'What is the capital of Bangladesh?',
      'English',
      'Grammar',
      'MCQ',
      'EASY',
      'DRAFT',
      'Dhaka',
      'Chittagong',
      'Rajshahi',
      'Khulna',
      'A',
      'Dhaka is the capital of Bangladesh.',
      'Bangladesh Public Service Commission',
      'Sample Examination',
      2025,
      'Assistant Director',
      'General',
      1,
      'Sample Question Paper',
      1,
      '',
      '',
      '',
      '',
      '',
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([
      headers,
      exampleRow,
    ]);

    worksheet['!cols'] = [
      { wch: 45 },
      { wch: 20 },
      { wch: 20 },
      { wch: 24 },
      { wch: 15 },
      { wch: 15 },
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
      { wch: 16 },
      { wch: 45 },
      { wch: 35 },
      { wch: 30 },
      { wch: 12 },
      { wch: 25 },
      { wch: 25 },
      { wch: 16 },
      { wch: 30 },
      { wch: 14 },
      { wch: 40 },
      { wch: 38 },
      { wch: 38 },
      { wch: 38 },
      { wch: 38 },
    ];

    const instructions = XLSX.utils.aoa_to_sheet([
      ['SHIKHASETU QUESTION IMPORT TEMPLATE'],
      ['IMPORTANT INSTRUCTIONS'],
      ['1. Each row represents one question.'],
      ['2. Enter the four choices in optionA, optionB, optionC and optionD.'],
      ['3. In optionE, enter the correct answer letter: A, B, C or D.'],
      ['4. The correctAnswer text is generated automatically from optionE.'],
      ['5. questionType: MCQ, TRUE_FALSE, FILL_IN_THE_BLANKS, WRITTEN.'],
      ['6. difficulty: EASY, MEDIUM, HARD.'],
      ['7. status: DRAFT, PUBLISHED, HIDDEN, ARCHIVED.'],
      ['8. institution, examName and examYear are required.'],
      ['9. examYear must be between 1900 and 2100.'],
      ['10. Optional IDs can be used to link existing records.'],
      ['11. Keep unused option columns blank.'],
      ['12. Do not rename or remove the column headers.'],
      ['13. Keep one exam occurrence per question row in this template.'],
      ['14. For multiple exam occurrences, import the question separately for each occurrence.'],
      ['15. The sample question row can be replaced or deleted.'],
    ]);

    instructions['!cols'] = [{ wch: 100 }];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Questions',
    );

    XLSX.utils.book_append_sheet(
      workbook,
      instructions,
      'Instructions',
    );

    let buffer: Buffer;
    let contentType: string;
    let fileName: string;

    if (normalizedFormat === 'xlsx') {
      buffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
      }) as Buffer;

      contentType =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      fileName = 'shikhasetu-question-import-template.xlsx';
    } else {
      const csv = XLSX.utils.sheet_to_csv(worksheet);

      buffer = Buffer.from(`\uFEFF${csv}`, 'utf8');

      contentType = 'text/csv; charset=utf-8';

      fileName = 'shikhasetu-question-import-template.csv';
    }

    response.setHeader('Content-Type', contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );
    response.setHeader('Content-Length', buffer.length);

    response.send(buffer);
  }

  @Get('export')
  async exportQuestions(
    @Query('format') format: string,
    @Res() response: Response,
  ) {
    if (!format) {
      throw new BadRequestException(
        'Export format is required: json, csv or xlsx.',
      );
    }

    const result =
      await this.exportService.exportQuestions(format);

    response.setHeader('Content-Type', result.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );
    response.setHeader('Content-Length', result.buffer.length);

    response.send(result.buffer);
  }

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit: number,
  ) {
    return this.importsService.findAll(page, limit);
  }

  @Get(':id/error-report')
  async errorReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('format') format: string = 'json',
    @Res() response: Response,
  ) {
    const result =
      await this.errorReportService.generateReport(id, format);

    response.setHeader('Content-Type', result.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );
    response.setHeader('Content-Length', result.buffer.length);

    response.send(result.buffer);
  }

  @Get(':id/rows')
  findRows(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page?: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe)
    limit?: number,
  ) {
    return this.importsService.findRows(
      id,
      status,
      page,
      limit,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.importsService.findOne(id);
  }

  @Post(':id/commit')
  commit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CommitImportDto,
  ) {
    return this.importsService.commit(id, dto.rowIds);
  }

  @Put(':id/skip')
  skipRows(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CommitImportDto,
  ) {
    if (!dto.rowIds || dto.rowIds.length === 0) {
      throw new BadRequestException(
        'At least one row ID is required.',
      );
    }

    return this.importsService.skipRows(id, dto.rowIds);
  }

  @Post(':id/rollback')
  rollback(@Param('id', ParseUUIDPipe) id: string) {
    return this.rollbackService.rollback(id);
  }
}

