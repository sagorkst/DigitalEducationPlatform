import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

export type OcrHistoryRowStatus =
  | 'PENDING'
  | 'VALID'
  | 'INVALID'
  | 'DUPLICATE'
  | 'IMPORTED'
  | 'SKIPPED';

@Injectable()
export class OcrHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async createBatch(
    file: Express.Multer.File,
    questions: Record<string, unknown>[],
  ) {
    if (!file || !questions.length) {
      throw new BadRequestException(
        'OCR file and extracted questions are required.',
      );
    }

    const extension =
      file.originalname.split('.').pop()?.toLowerCase() ?? 'unknown';

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.importBatch.create({
        data: {
          fileName: file.originalname,
          fileType: `${extension}-ocr`,
          status: 'REVIEW',
          totalRows: questions.length,
          validRows: 0,
          invalidRows: 0,
          duplicateRows: 0,
          importedRows: 0,
          skippedRows: 0,
          startedAt: new Date(),
        },
      });

      await tx.importRow.createMany({
        data: questions.map((question, index) => ({
          batchId: batch.id,
          rowNumber: index + 1,
          rawData: question as unknown as Prisma.InputJsonValue,
          status: 'PENDING',
        })),
      });

      const rows = await tx.importRow.findMany({
        where: { batchId: batch.id },
        select: {
          id: true,
          rowNumber: true,
        },
        orderBy: {
          rowNumber: 'asc',
        },
      });

      return {
        batchId: batch.id,
        rows,
      };
    });
  }

  async updateRow(
    batchId: string,
    rowId: string,
    status: OcrHistoryRowStatus,
    errorMessages?: unknown,
    questionId?: string | null,
    rawData?: unknown,
  ) {
    const allowedStatuses: OcrHistoryRowStatus[] = [
      'PENDING',
      'VALID',
      'INVALID',
      'DUPLICATE',
      'IMPORTED',
      'SKIPPED',
    ];

    if (!allowedStatuses.includes(status)) {
      throw new BadRequestException('Invalid OCR row status.');
    }

    if (
      rawData !== undefined &&
      (rawData === null || typeof rawData !== 'object' || Array.isArray(rawData))
    ) {
      throw new BadRequestException('OCR row data must be a JSON object.');
    }

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.importBatch.findUnique({
        where: { id: batchId },
        select: { id: true, fileType: true },
      });

      if (!batch || !batch.fileType.toLowerCase().endsWith('-ocr')) {
        throw new NotFoundException('OCR import batch was not found.');
      }

      const row = await tx.importRow.findFirst({
        where: {
          id: rowId,
          batchId,
        },
      });

      if (!row) {
        throw new NotFoundException('OCR import row was not found.');
      }

      if (row.status === 'IMPORTED' && status !== 'IMPORTED') {
        throw new BadRequestException(
          'An imported OCR question cannot be reverted.',
        );
      }

      const finalQuestionId =
        questionId === undefined ? row.questionId : questionId;

      if (status === 'IMPORTED' && !finalQuestionId) {
        throw new BadRequestException(
          'Question ID is required for an imported OCR row.',
        );
      }

      await tx.importRow.update({
        where: { id: rowId },
        data: {
          status,
          ...(questionId !== undefined ? { questionId } : {}),
          ...(rawData !== undefined
            ? {
                rawData: rawData as Prisma.InputJsonValue,
              }
            : {}),
          ...(errorMessages !== undefined
            ? {
                errorMessages:
                  errorMessages === null
                    ? Prisma.DbNull
                    : (errorMessages as Prisma.InputJsonValue),
              }
            : status !== 'INVALID'
              ? { errorMessages: Prisma.DbNull }
              : {}),
        },
      });

      const rows = await tx.importRow.findMany({
        where: { batchId },
        select: {
          status: true,
          rawData: true,
        },
      });

      const count = (value: string) =>
        rows.filter((item) => item.status === value).length;

      const totalRows = rows.length;
      const importedRows = count('IMPORTED');
      const skippedRows = count('SKIPPED');
      const duplicateRows = rows.filter((item) => {
        const rawData = item.rawData as
          | { _ocr?: { duplicateMatches?: unknown } }
          | null;

        return (
          item.status === 'DUPLICATE' ||
          (Array.isArray(rawData?._ocr?.duplicateMatches) &&
            rawData._ocr.duplicateMatches.length > 0)
        );
      }).length;
      const validRows = count('VALID') + importedRows;

      const isCompleted =
        totalRows > 0 &&
        rows.every((item) => {
          if (item.status === 'IMPORTED' || item.status === 'SKIPPED') {
            return true;
          }

          const rawData = item.rawData as
            | { _ocr?: { duplicateDecision?: string } }
            | null;

          return (
            item.status === 'DUPLICATE' &&
            rawData?._ocr?.duplicateDecision === 'SKIP'
          );
        });

      return tx.importBatch.update({
        where: { id: batchId },
        data: {
          totalRows,
          validRows,
          invalidRows: count('INVALID'),
          duplicateRows,
          importedRows,
          skippedRows,
          status: isCompleted ? 'COMPLETED' : 'REVIEW',
          completedAt: isCompleted ? new Date() : null,
        },
      });
    });
  }

  async updateRows(
    batchId: string,
    rows: Array<{
      rowId: string;
      status: OcrHistoryRowStatus;
      errorMessages?: unknown;
      questionId?: string | null;
      rawData: unknown;
    }>,
  ) {
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 200) {
      throw new BadRequestException(
        'Between 1 and 200 OCR history rows are required.',
      );
    }

    if (
      rows.some(
        (row) => !row || typeof row.rowId !== 'string' || !row.rowId,
      )
    ) {
      throw new BadRequestException(
        'OCR history row IDs must be valid.',
      );
    }

    const rowIds = rows.map((row) => row.rowId);
    if (new Set(rowIds).size !== rowIds.length) {
      throw new BadRequestException(
        'OCR history row IDs must be unique and valid.',
      );
    }

    const allowedStatuses: OcrHistoryRowStatus[] = [
      'PENDING',
      'VALID',
      'INVALID',
      'DUPLICATE',
      'IMPORTED',
      'SKIPPED',
    ];

    for (const row of rows) {
      if (
        !allowedStatuses.includes(row.status) ||
        row.rawData === null ||
        typeof row.rawData !== 'object' ||
        Array.isArray(row.rawData)
      ) {
        throw new BadRequestException('Invalid OCR history row data.');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.importBatch.findUnique({
        where: { id: batchId },
        select: { id: true, fileType: true },
      });

      if (!batch || !batch.fileType.toLowerCase().endsWith('-ocr')) {
        throw new NotFoundException('OCR import batch was not found.');
      }

      const existingRows = await tx.importRow.findMany({
        where: {
          batchId,
          id: { in: rowIds },
        },
        select: {
          id: true,
          status: true,
          questionId: true,
        },
      });

      if (existingRows.length !== rows.length) {
        throw new NotFoundException(
          'One or more OCR history rows were not found in this batch.',
        );
      }

      const existingById = new Map(
        existingRows.map((row) => [row.id, row]),
      );

      for (const item of rows) {
        const existing = existingById.get(item.rowId);
        if (!existing) continue;

        if (
          existing.status === 'IMPORTED' &&
          item.status !== 'IMPORTED'
        ) {
          throw new BadRequestException(
            'An imported OCR question cannot be reverted.',
          );
        }

        if (
          item.status === 'IMPORTED' &&
          !(item.questionId ?? existing.questionId)
        ) {
          throw new BadRequestException(
            'Question ID is required for an imported OCR row.',
          );
        }
      }

      await Promise.all(
        rows.map((item) =>
          tx.importRow.update({
            where: { id: item.rowId },
            data: {
              status: item.status,
              rawData: item.rawData as Prisma.InputJsonValue,
              ...(item.questionId !== undefined
                ? { questionId: item.questionId }
                : {}),
              ...(item.errorMessages !== undefined
                ? {
                    errorMessages:
                      item.errorMessages === null
                        ? Prisma.DbNull
                        : (item.errorMessages as Prisma.InputJsonValue),
                  }
                : item.status !== 'INVALID'
                  ? { errorMessages: Prisma.DbNull }
                  : {}),
            },
          }),
        ),
      );

      const allRows = await tx.importRow.findMany({
        where: { batchId },
        select: {
          status: true,
          rawData: true,
        },
      });

      const count = (status: string) =>
        allRows.filter((row) => row.status === status).length;

      const importedRows = count('IMPORTED');
      const skippedRows = count('SKIPPED');
      const duplicateRows = allRows.filter((row) => {
        const rawData = row.rawData as
          | { _ocr?: { duplicateMatches?: unknown } }
          | null;

        return (
          row.status === 'DUPLICATE' ||
          (Array.isArray(rawData?._ocr?.duplicateMatches) &&
            rawData._ocr.duplicateMatches.length > 0)
        );
      }).length;
      const validRows = count('VALID') + importedRows;

      const isCompleted =
        allRows.length > 0 &&
        allRows.every((row) => {
          if (row.status === 'IMPORTED' || row.status === 'SKIPPED') {
            return true;
          }

          const rawData = row.rawData as
            | { _ocr?: { duplicateDecision?: string } }
            | null;

          return (
            row.status === 'DUPLICATE' &&
            rawData?._ocr?.duplicateDecision === 'SKIP'
          );
        });

      return tx.importBatch.update({
        where: { id: batchId },
        data: {
          totalRows: allRows.length,
          validRows,
          invalidRows: count('INVALID'),
          duplicateRows,
          importedRows,
          skippedRows,
          status: isCompleted ? 'COMPLETED' : 'REVIEW',
          completedAt: isCompleted ? new Date() : null,
        },
      });
    });
  }

}
