import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { stringify } from 'csv-stringify/sync';
import * as XLSX from 'xlsx';

@Injectable()
export class ImportsExportService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async exportQuestions(format: string) {
    const fileType = format.toLowerCase();

    if (!['json', 'csv', 'xlsx'].includes(fileType)) {
      throw new BadRequestException(
        'Unsupported export format. Use JSON, CSV or XLSX.',
      );
    }

    const questions = await this.prisma.question.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        options: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        occurrences: {
          orderBy: {
            examYear: 'desc',
          },
        },
      },
    });

    const data = questions.map((question) => ({
      questionCode: question.questionCode,
      questionText: question.questionText,
      questionType: question.questionType,
      subject: question.subject,
      topic: question.topic,
      subjectId: question.subjectId,
      topicId: question.topicId,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      difficulty: question.difficulty,
      status: question.status,
      options: question.options.map((option) => ({
        label: option.label,
        optionText: option.optionText,
        isCorrect: option.isCorrect,
        sortOrder: option.sortOrder,
      })),
      occurrences: question.occurrences.map((occurrence) => ({
        institution: occurrence.institution,
        examName: occurrence.examName,
        examYear: occurrence.examYear,
        postName: occurrence.postName,
        department: occurrence.department,
        questionNumber: occurrence.questionNumber,
        source: occurrence.source,
        sourcePage: occurrence.sourcePage,
        sourceUrl: occurrence.sourceUrl,
        institutionId: occurrence.institutionId,
        examId: occurrence.examId,
        postId: occurrence.postId,
        sourceDocumentId: occurrence.sourceDocumentId,
      })),
    }));

    if (fileType === 'json') {
      return {
        fileName: 'shikhasetu-questions.json',
        contentType: 'application/json; charset=utf-8',
        buffer: Buffer.from(
          JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              totalQuestions: data.length,
              questions: data,
            },
            null,
            2,
          ),
          'utf8',
        ),
      };
    }

    const flatData = data.map((question) => ({
      ...question,
      options: JSON.stringify(question.options),
      occurrences: JSON.stringify(question.occurrences),
    }));

    if (fileType === 'csv') {
      const csv = stringify(flatData, {
        header: true,
        bom: true,
      });

      return {
        fileName: 'shikhasetu-questions.csv',
        contentType: 'text/csv; charset=utf-8',
        buffer: Buffer.from(csv, 'utf8'),
      };
    }

    const worksheet = XLSX.utils.json_to_sheet(flatData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Questions',
    );

    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer;

    return {
      fileName: 'shikhasetu-questions.xlsx',
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    };
  }
}