import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ImportsRollbackService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async rollback(batchId: string) {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id: batchId },
      include: {
        rows: {
          where: {
            status: 'IMPORTED',
            questionId: {
              not: null,
            },
          },
          select: {
            id: true,
            questionId: true,
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Import batch not found.');
    }

    if (batch.status !== 'COMPLETED') {
      throw new BadRequestException(
        'Only completed import batches can be rolled back.',
      );
    }

    if (!batch.startedAt || !batch.completedAt) {
      throw new BadRequestException(
        'Import batch timing information is missing.',
      );
    }

    const questionIds = [
      ...new Set(
        batch.rows
          .map((row) => row.questionId)
          .filter((id): id is string => id !== null),
      ),
    ];

    if (questionIds.length === 0) {
      throw new BadRequestException(
        'No imported questions found for rollback.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const questions = await tx.question.findMany({
        where: {
          id: {
            in: questionIds,
          },
        },
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
      });

      if (questions.length !== questionIds.length) {
        throw new ConflictException(
          'Some imported questions are missing. Rollback cancelled.',
        );
      }

      const unsafeQuestions = questions.filter(
        (question) =>
          question.deletedAt !== null ||
          question.createdAt < batch.startedAt! ||
          question.updatedAt > batch.completedAt!,
      );

      if (unsafeQuestions.length > 0) {
        throw new ConflictException(
          `${unsafeQuestions.length} imported question(s) were modified or deleted after import. Rollback cancelled.`,
        );
      }

      const referencedElsewhere =
        await tx.importRow.findMany({
          where: {
            questionId: {
              in: questionIds,
            },
            batchId: {
              not: batchId,
            },
          },
          select: {
            questionId: true,
          },
          distinct: ['questionId'],
        });

      if (referencedElsewhere.length > 0) {
        throw new ConflictException(
          'Some questions are referenced by another import batch. Rollback cancelled.',
        );
      }

      await tx.question.updateMany({
        where: {
          id: {
            in: questionIds,
          },
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      const updatedBatch =
        await tx.importBatch.update({
          where: {
            id: batchId,
          },
          data: {
            status: 'ROLLED_BACK',
            rolledBackAt: new Date(),
          },
        });

      return {
        success: true,
        message: 'Import batch rolled back successfully.',
        data: {
          batchId,
          status: updatedBatch.status,
          rolledBackQuestions: questionIds.length,
          rolledBackAt: updatedBatch.rolledBackAt,
        },
      };
    });
  }
}