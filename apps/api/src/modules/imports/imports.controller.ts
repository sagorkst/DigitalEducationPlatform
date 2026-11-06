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
  Res,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';

import { ImportsService } from './imports.service';
import { ImportsExportService } from './imports-export.service';
import { ImportsRollbackService } from './imports-rollback.service';
import { ImportsErrorReportService } from './imports-error-report.service';
import { CommitImportDto } from './dto/commit-import.dto';

@Controller('imports')
export class ImportsController {
  constructor(
    private readonly importsService: ImportsService,
    private readonly exportService: ImportsExportService,
    private readonly rollbackService: ImportsRollbackService,
    private readonly errorReportService: ImportsErrorReportService,
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