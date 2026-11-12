import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { stringify } from 'csv-stringify/sync';

@Injectable()
export class ImportsErrorReportService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async generateReport(
    batchId: string,
    format: string = 'json',
  ) {
    const fileType = format.toLowerCase();

    if (!['json', 'csv'].includes(fileType)) {
      throw new BadRequestException(
        'Unsupported report format. Use JSON or CSV.',
      );
    }

    const batch = await this.prisma.importBatch.findUnique({
      where: {
        id: batchId,
      },
      include: {
        rows: {
          orderBy: {
            rowNumber: 'asc',
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException(
        'Import batch not found.',
      );
    }

    const rows = batch.rows.map((row) => {
      const errors = Array.isArray(row.errorMessages)
        ? row.errorMessages
        : row.errorMessages
          ? [row.errorMessages]
          : [];

      return {
        rowNumber: row.rowNumber,
        status: row.status,
        errors,
        rawData: row.rawData,
        questionId: row.questionId,
      };
    });

    const errorRows = rows.filter(
      (row) =>
        row.status === 'INVALID' ||
        row.status === 'DUPLICATE',
    );

    const report = {
      reportGeneratedAt: new Date().toISOString(),
      batch: {
        id: batch.id,
        fileName: batch.fileName,
        fileType: batch.fileType,
        status: batch.status,
        createdAt: batch.createdAt,
        completedAt: batch.completedAt,
      },
      summary: {
        totalRows: batch.totalRows,
        validRows: batch.validRows,
        invalidRows: batch.invalidRows,
        duplicateRows: batch.duplicateRows,
        importedRows: batch.importedRows,
        skippedRows: batch.skippedRows,
        errorRows: errorRows.length,
      },
      errorRows,
    };

    if (fileType === 'json') {
      return {
        fileName: `import-error-report-${batchId}.json`,
        contentType: 'application/json; charset=utf-8',
        buffer: Buffer.from(
          JSON.stringify(report, null, 2),
          'utf8',
        ),
      };
    }

    const csvRows = errorRows.map((row) => ({
      rowNumber: row.rowNumber,
      status: row.status,
      errors: JSON.stringify(row.errors),
      rawData: JSON.stringify(row.rawData),
      questionId: row.questionId ?? '',
    }));

    const csv = stringify(csvRows, {
      header: true,
      bom: true,
    });

    return {
      fileName: `import-error-report-${batchId}.csv`,
      contentType: 'text/csv; charset=utf-8',
      buffer: Buffer.from(csv, 'utf8'),
    };
  }
}