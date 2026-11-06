import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { QuestionsService } from '../questions/questions.service';
import { CreateQuestionDto } from '../questions/dto/create-question.dto';

import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

type ImportFile = Express.Multer.File;
type ImportData = Record<string, unknown>;

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questionsService: QuestionsService,
  ) {}

  private normalizeText(value: string): string {
    return value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private parseJsonValue(value: unknown): unknown {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return undefined;
    }

    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }

  private parseFile(file: ImportFile): ImportData[] {
    const extension = file.originalname
      .split('.')
      .pop()
      ?.toLowerCase();

    let rows: unknown[];

    try {
      if (extension === 'json') {
        const parsed = JSON.parse(file.buffer.toString('utf8'));

        rows = Array.isArray(parsed)
          ? parsed
          : parsed?.questions;

      } else if (extension === 'csv') {
        rows = parse(file.buffer, {
          columns: true,
          skip_empty_lines: true,
          bom: true,
          trim: true,
          relax_column_count: false,
        });

      } else if (extension === 'xlsx' || extension === 'xls') {
        const workbook = XLSX.read(file.buffer, {
          type: 'buffer',
        });

        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

        if (!firstSheet) {
          throw new BadRequestException(
            'Excel file does not contain a worksheet.',
          );
        }

        rows = XLSX.utils.sheet_to_json(firstSheet, {
          defval: '',
          raw: false,
        });

      } else {
        throw new BadRequestException(
          'Unsupported file format. Use JSON, CSV or XLSX.',
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        'Unable to read the uploaded file. Please check its format.',
      );
    }

    if (!Array.isArray(rows)) {
      throw new BadRequestException(
        'Invalid file structure. JSON must contain an array or a questions array.',
      );
    }

    if (rows.length === 0) {
      throw new BadRequestException(
        'The uploaded file does not contain any question rows.',
      );
    }

    if (rows.length > 10000) {
      throw new BadRequestException(
        'Maximum 10000 rows are allowed per import batch.',
      );
    }

    return rows.map((row, index) => {
      if (
        typeof row !== 'object' ||
        row === null ||
        Array.isArray(row)
      ) {
        throw new BadRequestException(
          `Invalid data structure at row ${index + 1}.`,
        );
      }

      const data = { ...(row as ImportData) };

      if ('options' in data) {
        data.options = this.parseJsonValue(data.options);
      }

      if ('occurrences' in data) {
        data.occurrences = this.parseJsonValue(data.occurrences);
      }

      return data;
    });
  }

  private validateRow(data: ImportData): string[] {
    const errors: string[] = [];

    const questionText = data.questionText;
    const subject = data.subject;
    const topic = data.topic;

    if (
      typeof questionText !== 'string' ||
      !questionText.trim()
    ) {
      errors.push('Question text is required.');
    } else if (questionText.length > 1000) {
      errors.push('Question text cannot exceed 1000 characters.');
    }

    if (
      typeof subject !== 'string' ||
      !subject.trim()
    ) {
      errors.push('Subject is required.');
    } else if (subject.length > 200) {
      errors.push('Subject cannot exceed 200 characters.');
    }

    if (
      typeof topic !== 'string' ||
      !topic.trim()
    ) {
      errors.push('Topic is required.');
    } else if (topic.length > 200) {
      errors.push('Topic cannot exceed 200 characters.');
    }

    const questionType = data.questionType ?? 'MCQ';

    const allowedTypes = [
      'MCQ',
      'TRUE_FALSE',
      'FILL_IN_THE_BLANKS',
      'WRITTEN',
    ];

    if (
      typeof questionType !== 'string' ||
      !allowedTypes.includes(questionType)
    ) {
      errors.push('Invalid question type.');
    }

    const difficulty = data.difficulty ?? 'MEDIUM';

    if (
      !['EASY', 'MEDIUM', 'HARD'].includes(
        String(difficulty),
      )
    ) {
      errors.push('Invalid difficulty.');
    }

    const status = data.status ?? 'DRAFT';

    if (
      !['DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED'].includes(
        String(status),
      )
    ) {
      errors.push('Invalid question status.');
    }

    const options = data.options;

    if (
      options !== undefined &&
      options !== null
    ) {
      if (!Array.isArray(options)) {
        errors.push('Options must be an array.');
      } else {
        if (options.length < 2 || options.length > 10) {
          errors.push('Options must contain 2 to 10 items.');
        }

        const labels = new Set<string>();
        let correctCount = 0;

        options.forEach((option, index) => {
          if (
            typeof option !== 'object' ||
            option === null ||
            Array.isArray(option)
          ) {
            errors.push(`Option ${index + 1} is invalid.`);
            return;
          }

          const item = option as ImportData;

          if (
            typeof item.label !== 'string' ||
            !item.label.trim()
          ) {
            errors.push(`Option ${index + 1} requires a label.`);
          } else {
            const label = item.label.trim().toUpperCase();

            if (labels.has(label)) {
              errors.push(`Duplicate option label: ${label}.`);
            }

            labels.add(label);
          }

          if (
            typeof item.optionText !== 'string' ||
            !item.optionText.trim()
          ) {
            errors.push(`Option ${index + 1} requires option text.`);
          }

          if (
            item.isCorrect !== undefined &&
            typeof item.isCorrect !== 'boolean'
          ) {
            errors.push(
              `Option ${index + 1} has invalid isCorrect value.`,
            );
          }

          if (item.isCorrect === true) {
            correctCount++;
          }
        });

        if (
          questionType === 'MCQ' &&
          correctCount !== 1
        ) {
          errors.push(
            'MCQ must have exactly one correct option.',
          );
        }
      }
    } else if (questionType === 'MCQ') {
      errors.push('MCQ questions require options.');
    }

    const occurrences = data.occurrences;

    if (!Array.isArray(occurrences) || occurrences.length < 1) {
      errors.push('At least one occurrence is required.');
    } else {
      occurrences.forEach((occurrence, index) => {
        if (
          typeof occurrence !== 'object' ||
          occurrence === null ||
          Array.isArray(occurrence)
        ) {
          errors.push(
            `Occurrence ${index + 1} is invalid.`,
          );
          return;
        }

        const item = occurrence as ImportData;

        if (
          typeof item.institution !== 'string' ||
          !item.institution.trim()
        ) {
          errors.push(
            `Occurrence ${index + 1}: institution is required.`,
          );
        }

        if (
          typeof item.examName !== 'string' ||
          !item.examName.trim()
        ) {
          errors.push(
            `Occurrence ${index + 1}: exam name is required.`,
          );
        }

        const year = Number(item.examYear);

        if (
          !Number.isInteger(year) ||
          year < 1900 ||
          year > 2100
        ) {
          errors.push(
            `Occurrence ${index + 1}: exam year must be between 1900 and 2100.`,
          );
        }
      });
    }

    if (
      data.correctAnswer !== undefined &&
      typeof data.correctAnswer !== 'string'
    ) {
      errors.push('Correct answer must be text.');
    }

    if (
      data.explanation !== undefined &&
      typeof data.explanation !== 'string'
    ) {
      errors.push('Explanation must be text.');
    }

    return errors;
  }

  async preview(file: ImportFile) {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }

    if (!file.buffer || file.size === 0) {
      throw new BadRequestException('Uploaded file is empty.');
    }

    const rows = this.parseFile(file);

    const batch = await this.prisma.importBatch.create({
      data: {
        fileName: file.originalname,
        fileType: file.originalname
          .split('.')
          .pop()
          ?.toLowerCase() ?? 'unknown',
        status: 'PROCESSING',
        totalRows: rows.length,
        startedAt: new Date(),
      },
    });

    const preparedRows: Prisma.ImportRowCreateManyInput[] = [];

    let validRows = 0;
    let invalidRows = 0;
    let duplicateRows = 0;

    const seenQuestions = new Set<string>();

    try {
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];

        const errors = this.validateRow(row);

        let rowStatus:
          | 'VALID'
          | 'INVALID'
          | 'DUPLICATE' = 'VALID';

        if (errors.length > 0) {
          rowStatus = 'INVALID';
          invalidRows++;
        } else {
          const questionText = String(row.questionText);
          const normalized = this.normalizeText(questionText);

          if (seenQuestions.has(normalized)) {
            rowStatus = 'DUPLICATE';
            errors.push(
              'Duplicate question found within this import file.',
            );
            duplicateRows++;
          } else {
            seenQuestions.add(normalized);

            const existing = await this.prisma.question.findFirst({
              where: {
                deletedAt: null,
                questionText: {
                  equals: questionText,
                  mode: 'insensitive',
                },
              },
              select: {
                id: true,
              },
            });

            if (existing) {
              rowStatus = 'DUPLICATE';
              errors.push(
                'An identical question already exists in the question bank.',
              );
              duplicateRows++;
            } else {
              validRows++;
            }
          }
        }

        preparedRows.push({
          batchId: batch.id,
          rowNumber: index + 1,
          rawData: row as Prisma.InputJsonValue,
          status: rowStatus,
          errorMessages:
            errors.length > 0
              ? (errors as Prisma.InputJsonValue)
              : Prisma.JsonNull,
        });
      }

      await this.prisma.importRow.createMany({
        data: preparedRows,
      });

      const updatedBatch = await this.prisma.importBatch.update({
        where: {
          id: batch.id,
        },
        data: {
          status: 'REVIEW',
          validRows,
          invalidRows,
          duplicateRows,
          completedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Import preview generated successfully.',
        data: {
          batch: updatedBatch,
          summary: {
            totalRows: rows.length,
            validRows,
            invalidRows,
            duplicateRows,
          },
        },
      };
    } catch (error) {
      await this.prisma.importBatch.update({
        where: {
          id: batch.id,
        },
        data: {
          status: 'FAILED',
          errorSummary: {
            message:
              error instanceof Error
                ? error.message
                : 'Unknown import error',
          },
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }

  async findAll(page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));

    const [data, total] = await this.prisma.$transaction([
      this.prisma.importBatch.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        include: {
          _count: {
            select: {
              rows: true,
            },
          },
        },
      }),
      this.prisma.importBatch.count(),
    ]);

    return {
      success: true,
      data,
      pagination: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async findOne(id: string) {
    const batch = await this.prisma.importBatch.findUnique({
      where: {
        id,
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
      throw new NotFoundException('Import batch not found.');
    }

    return {
      success: true,
      data: batch,
    };
  }

  async findRows(
    batchId: string,
    status?: string,
    page = 1,
    limit = 50,
  ) {
    const batch = await this.prisma.importBatch.findUnique({
      where: {
        id: batchId,
      },
      select: {
        id: true,
      },
    });

    if (!batch) {
      throw new NotFoundException('Import batch not found.');
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));

    const where: Prisma.ImportRowWhereInput = {
      batchId,
    };

    if (status) {
      const allowedStatuses = [
        'PENDING',
        'VALID',
        'INVALID',
        'DUPLICATE',
        'IMPORTED',
        'SKIPPED',
      ];

      if (!allowedStatuses.includes(status)) {
        throw new BadRequestException(
          'Invalid import row status.',
        );
      }

      where.status = status as Prisma.EnumImportRowStatusFilter['equals'];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.importRow.findMany({
        where,
        orderBy: {
          rowNumber: 'asc',
        },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.importRow.count({
        where,
      }),
    ]);

    return {
      success: true,
      data,
      pagination: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async commit(batchId: string, rowIds?: string[]) {
    const batch = await this.prisma.importBatch.findUnique({
      where: {
        id: batchId,
      },
    });

    if (!batch) {
      throw new NotFoundException('Import batch not found.');
    }

    if (batch.status !== 'REVIEW') {
      throw new BadRequestException(
        'Only batches in REVIEW status can be imported.',
      );
    }

    const where: Prisma.ImportRowWhereInput = {
      batchId,
      status: 'VALID',
    };

    if (rowIds && rowIds.length > 0) {
      where.id = {
        in: rowIds,
      };
    }

    const rows = await this.prisma.importRow.findMany({
      where,
      orderBy: {
        rowNumber: 'asc',
      },
    });

    if (rows.length === 0) {
      throw new BadRequestException(
        'No valid rows available for import.',
      );
    }

    await this.prisma.importBatch.update({
      where: {
        id: batchId,
      },
      data: {
        status: 'PROCESSING',
        startedAt: new Date(),
      },
    });

    let importedRows = 0;
    let failedRows = 0;

    for (const row of rows) {
      try {
        const dto = row.rawData as unknown as CreateQuestionDto;

        const result = await this.questionsService.create(dto);

        const questionId = result.data?.id;

        if (!questionId) {
          throw new Error(
            'Question creation did not return an ID.',
          );
        }

        await this.prisma.importRow.update({
          where: {
            id: row.id,
          },
          data: {
            status: 'IMPORTED',
            questionId,
            errorMessages: Prisma.JsonNull,
          },
        });

        importedRows++;
      } catch (error) {
        failedRows++;

        await this.prisma.importRow.update({
          where: {
            id: row.id,
          },
          data: {
            status: 'INVALID',
            errorMessages: [
              error instanceof Error
                ? error.message
                : 'Question import failed.',
            ],
          },
        });
      }
    }

    const remainingValid = await this.prisma.importRow.count({
      where: {
        batchId,
        status: 'VALID',
      },
    });

    const finalBatch = await this.prisma.importBatch.update({
      where: {
        id: batchId,
      },
      data: {
        status: remainingValid > 0 ? 'REVIEW' : 'COMPLETED',
        importedRows: {
          increment: importedRows,
        },
        invalidRows: {
          increment: failedRows,
        },
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Import processing completed.',
      data: {
        batch: finalBatch,
        importedRows,
        failedRows,
        remainingValidRows: remainingValid,
      },
    };
  }

  async skipRows(batchId: string, rowIds: string[]) {
    const batch = await this.prisma.importBatch.findUnique({
      where: {
        id: batchId,
      },
    });

    if (!batch) {
      throw new NotFoundException('Import batch not found.');
    }

    if (batch.status !== 'REVIEW') {
      throw new BadRequestException(
        'Rows can only be skipped while the batch is in REVIEW status.',
      );
    }

    const result = await this.prisma.importRow.updateMany({
      where: {
        batchId,
        id: {
          in: rowIds,
        },
        status: {
          in: ['VALID', 'INVALID', 'DUPLICATE'],
        },
      },
      data: {
        status: 'SKIPPED',
      },
    });

    await this.prisma.importBatch.update({
      where: {
        id: batchId,
      },
      data: {
        skippedRows: {
          increment: result.count,
        },
      },
    });

    return {
      success: true,
      message: 'Selected rows skipped successfully.',
      data: {
        skippedRows: result.count,
      },
    };
  }
}