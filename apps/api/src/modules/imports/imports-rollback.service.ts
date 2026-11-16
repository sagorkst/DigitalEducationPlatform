import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ImportsRollbackService {
  constructor(private readonly prisma: PrismaService) {}

  async rollback(batchId: string) {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id: batchId },
      include: {
        rows: {
          where: {
            status: 'IMPORTED',
            questionId: { not: null },
          },
          select: {
            id: true,
            questionId: true,
            rawData: true,
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

    const createdQuestionIds = new Set<string>();
    const linkedOccurrenceIds = new Set<string>();

    for (const row of batch.rows) {
      if (!row.questionId) continue;

      const raw =
        row.rawData &&
        typeof row.rawData === 'object' &&
        !Array.isArray(row.rawData)
          ? (row.rawData as Record<string, unknown>)
          : {};

      const tracking =
        raw._importTracking &&
        typeof raw._importTracking === 'object' &&
        !Array.isArray(raw._importTracking)
          ? (raw._importTracking as Record<string, unknown>)
          : null;

      const occurrenceIds = Array.isArray(tracking?.occurrenceIds)
        ? tracking.occurrenceIds.filter(
            (id): id is string => typeof id === 'string',
          )
        : [];

      if (tracking?.action === 'LINKED_OCCURRENCE') {
        for (const id of occurrenceIds) {
          linkedOccurrenceIds.add(id);
        }
      } else {
        // CREATED_QUESTION and legacy rows without tracking metadata.
        // Legacy imports are treated as newly created questions.
        createdQuestionIds.add(row.questionId);

        for (const id of occurrenceIds) {
          linkedOccurrenceIds.add(id);
        }
      }
    }

    const questionIds = [...createdQuestionIds];
    const occurrenceIds = [...linkedOccurrenceIds];

    if (questionIds.length === 0 && occurrenceIds.length === 0) {
      throw new BadRequestException(
        'No imported questions or linked occurrences found for rollback.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (questionIds.length > 0) {
        const questions = await tx.question.findMany({
          where: { id: { in: questionIds } },
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

        const referencedElsewhere = await tx.importRow.findMany({
          where: {
            questionId: { in: questionIds },
            batchId: { not: batchId },
          },
          select: { questionId: true },
          distinct: ['questionId'],
        });

        if (referencedElsewhere.length > 0) {
          throw new ConflictException(
            'Some questions are referenced by another import batch. Rollback cancelled.',
          );
        }
      }

      let rolledBackOccurrences = 0;

      if (occurrenceIds.length > 0) {
        const deletedOccurrences = await tx.questionOccurrence.deleteMany({
          where: { id: { in: occurrenceIds } },
        });

        rolledBackOccurrences = deletedOccurrences.count;
      }

      if (questionIds.length > 0) {
        await tx.question.updateMany({
          where: {
            id: { in: questionIds },
            deletedAt: null,
          },
          data: { deletedAt: new Date() },
        });
      }

      const updatedBatch = await tx.importBatch.update({
        where: { id: batchId },
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
          rolledBackOccurrences,
          rolledBackAt: updatedBatch.rolledBackAt,
        },
      };
    });
  }
}