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
import { simpleParser } from 'mailparser';

import { ImportsService } from './imports.service';
import { ImportsExportService } from './imports-export.service';
import { ImportsRollbackService } from './imports-rollback.service';
import { ImportsErrorReportService } from './imports-error-report.service';
import { OcrService } from './ocr.service';
import { OcrHistoryService } from './ocr-history.service';
import { HtmlQuestionParserService } from './html-question-parser.service';
import { CommitImportDto } from './dto/commit-import.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';

@Controller('imports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('content.manage')
export class ImportsController {
  constructor(
    private readonly importsService: ImportsService,
    private readonly exportService: ImportsExportService,
    private readonly rollbackService: ImportsRollbackService,
    private readonly errorReportService: ImportsErrorReportService,
    private readonly ocrService: OcrService,
    private readonly ocrHistoryService: OcrHistoryService,
    private readonly htmlQuestionParserService: HtmlQuestionParserService,
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

  @Post('html/preview')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async htmlPreview(@UploadedFile() file: Express.Multer.File) {
    if (!file || !file.buffer) {
      throw new BadRequestException(
        'Please upload a saved HTML or HTM file.',
      );
    }

    if (!/\.(html?|xhtml|mhtml|mht)$/i.test(file.originalname || '')) {
      throw new BadRequestException(
        'Only HTML, HTM or XHTML files are supported.',
      );
    }

    const isMhtml = /\.(mhtml|mht)$/i.test(file.originalname || '');
    let html: string;

    if (isMhtml) {
      const mimeMessage = await simpleParser(file.buffer);
      html =
        typeof mimeMessage.html === 'string'
          ? mimeMessage.html
          : '';

      if (!html.trim()) {
        throw new BadRequestException(
          'No HTML content was found inside the MHTML file.',
        );
      }
    } else {
      html = file.buffer
        .toString('utf8')
        .replace(/^\uFEFF/, '');
    }

    if (!html.trim()) {
      throw new BadRequestException(
        'The uploaded HTML file is empty.',
      );
    }

    const parsed = this.htmlQuestionParserService.parse(
      html,
      file.originalname,
    );

    if (parsed.questions.length > 10000) {
      throw new BadRequestException(
        'HTML import cannot contain more than 10,000 questions.',
      );
    }

    const rows = parsed.questions.map((question) => {
      const options = question.options.map((option, index) => ({
        label: option.label,
        optionText: option.text,
        imageReferences: option.imageReferences,
        isCorrect: option.isCorrect === true,
        sortOrder: index + 1,
      }));

      const correctOption = question.options.find(
        (option) =>
          option.label.toUpperCase() ===
          (question.correctAnswer ?? '').toUpperCase(),
      );

      return {
        questionText: question.questionText,
        imageReferences: question.imageReferences,
        questionType: question.questionType,
        subject: question.subject ?? '',
        topic: question.topic ?? '',
        difficulty: 'MEDIUM',
        status: 'DRAFT',
        ...(question.questionType === 'MCQ' ? { options } : {}),
        ...(correctOption
          ? { correctAnswer: correctOption.text }
          : {}),
        ...(question.explanation
          ? { explanation: question.explanation }
          : {}),
        occurrences: [
          {
            institution: question.institution ?? '',
            examName: question.examName ?? '',
            examYear: question.examYear ?? null,
            source: 'HTML_IMPORT',
            sourceUrl: question.sourceUrl ?? undefined,
          },
        ],
        htmlImportMetadata: {
          sourceUrl: question.sourceUrl,
          sourceQuestionId: question.sourceQuestionId,
          imageReferences: question.imageReferences,
          optionImageReferences: question.options.map((option) => ({
            label: option.label,
            imageReferences: option.imageReferences,
          })),
          confidence: question.confidence,
          warnings: question.warnings,
        },
      };
    });

    const preview = await this.importsService.previewParsedRows(
      rows,
      file.originalname,
      'html',
    );

    return {
      ...preview,
      parser: {
        detectedStructure: parsed.detectedStructure,
        totalCandidates: parsed.totalCandidates,
        extractedCount: parsed.extractedCount,
        skippedCount: parsed.skippedCount,
        warnings: parsed.warnings,
      },
    };
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
      'correctAnswer',
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
      'occurrences',
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
      '[{"institution":"Bangladesh Public Service Commission","examName":"Sample Examination","examYear":2025,"postName":"Assistant Director"},{"institution":"Bangladesh Public Service Commission","examName":"Another Sample Examination","examYear":2024,"postName":"Assistant Director"}]',
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
      { wch: 100 },
    ];

    const instructions = XLSX.utils.aoa_to_sheet([
      ['SHIKHASETU QUESTION IMPORT TEMPLATE'],
      ['IMPORTANT INSTRUCTIONS'],
      ['1. Each row represents one question.'],
      ['2. Enter the four choices in optionA, optionB, optionC and optionD.'],
      ['3. In correctAnswer, enter the correct option letter (A, B, C or D) or exact answer text.'],
      ['4. For MCQ, the correctAnswer value marks the matching option as correct.'],
      ['5. questionType: MCQ, TRUE_FALSE, FILL_IN_THE_BLANKS, WRITTEN.'],
      ['6. difficulty: EASY, MEDIUM, HARD.'],
      ['7. status: DRAFT, PUBLISHED, HIDDEN, ARCHIVED.'],
      ['8. Add at least one exam occurrence with institution, examName and examYear.'],
      ['9. examYear must be between 1900 and 2100.'],
      ['10. Optional IDs can be used to link existing records.'],
      ['11. Keep unused option columns blank.'],
      ['12. Do not rename or remove the column headers.'],
      ['13. Use the occurrences column to attach one question to one or multiple exams.'],
      ['14. occurrences must contain a JSON array. Each item can include institution, examName, examYear, postName, department, examId and institutionId.'],
      ['15. The sample row demonstrates one question linked to two exams; replace or delete it.'],
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

  @Put(':id/metadata')
  @HttpCode(HttpStatus.OK)
  applyBatchMetadata(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      institution?: unknown;
      examName?: unknown;
      examYear?: unknown;
      postName?: unknown;
      department?: unknown;
      occurrences?: unknown;
      rowIds?: unknown;
      applyTo?: unknown;
      overwriteExisting?: unknown;
      setAsPrimary?: unknown;
    },
  ) {
    return this.importsService.applyBatchMetadata(id, body);
  }

  @Put(':id/duplicate-review')
  @HttpCode(HttpStatus.OK)
  reviewDuplicates(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { rowIds?: unknown; action?: unknown },
  ) {
    if (
      !Array.isArray(body.rowIds) ||
      body.rowIds.length === 0 ||
      body.rowIds.some((rowId) => typeof rowId !== 'string')
    ) {
      throw new BadRequestException('Select at least one duplicate row.');
    }

    if (body.action !== 'PASS' && body.action !== 'RECHECK') {
      throw new BadRequestException('Duplicate review action must be PASS or RECHECK.');
    }

    return this.importsService.reviewDuplicates(
      id,
      body.rowIds as string[],
      body.action,
    );
  }

  @Put(':id/rows/:rowId')
  @HttpCode(HttpStatus.OK)
  updateImportRow(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('rowId', ParseUUIDPipe) rowId: string,
    @Body() body: { rawData: unknown },
  ) {
    return this.importsService.updateImportRow(
      id,
      rowId,
      body.rawData,
    );
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
    if ((!dto.rowIds || dto.rowIds.length === 0) && dto.allRows !== true) {
      throw new BadRequestException(
        'Select at least one row or choose all rows.',
      );
    }

    return this.importsService.commit(
      id,
      dto.rowIds,
      dto.allRows === true,
      dto.excludedRowIds,
    );
  }

  @Put(':id/skip')
  skipRows(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CommitImportDto,
  ) {
    if ((!dto.rowIds || dto.rowIds.length === 0) && dto.allRows !== true) {
      throw new BadRequestException(
        'Select at least one row or choose all rows.',
      );
    }

    return this.importsService.skipRows(
      id,
      dto.rowIds,
      dto.allRows === true,
      dto.excludedRowIds,
    );
  }

  @Post(':id/rollback')
  rollback(@Param('id', ParseUUIDPipe) id: string) {
    return this.rollbackService.rollback(id);
  }
}
