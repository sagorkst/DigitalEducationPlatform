import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { BulkUpdateQuestionsDto } from './dto/bulk-update-questions.dto';
import { BulkFilteredQuestionsDto } from './dto/bulk-filtered-questions.dto';
import { QuestionsService } from './questions.service';

@Injectable()
export class QuestionsBulkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questionsService: QuestionsService,
  ) {}

  private async collectFilteredIds(
    filters: BulkFilteredQuestionsDto['filters'],
    excludedIds: string[] = [],
  ) {
    const ids: string[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const result = await this.questionsService.findAll({
        ...filters,
        page: String(page),
        limit: '100',
      });
      ids.push(...result.data.map((question) => question.id));
      totalPages = result.pagination.totalPages;
      page += 1;
    } while (page <= totalPages);
    if (excludedIds.length === 0) return ids;
    const excluded = new Set(excludedIds);
    return ids.filter((id) => !excluded.has(id));
  }

  async bulkUpdateFiltered(dto: BulkFilteredQuestionsDto) {
    const updates = dto.updates;
    if (!updates) throw new BadRequestException('Bulk updates are required.');
    const ids = await this.collectFilteredIds(dto.filters, dto.excludedIds);
    let updatedCount = 0;
    let batches = 0;
    for (let index = 0; index < ids.length; index += 500) {
      const result = await this.bulkUpdate({ ids: ids.slice(index, index + 500), updates });
      updatedCount += result.updatedCount;
      batches += 1;
    }
    return { success: true, message: `${updatedCount} matching question(s) updated successfully.`, updatedCount, matchedCount: ids.length, batches };
  }

  async bulkSoftDeleteFiltered(dto: BulkFilteredQuestionsDto) {
    const ids = await this.collectFilteredIds(dto.filters, dto.excludedIds);
    let deletedCount = 0;
    let batches = 0;
    for (let index = 0; index < ids.length; index += 500) {
      const result = await this.bulkSoftDelete(ids.slice(index, index + 500));
      deletedCount += result.deletedCount;
      batches += 1;
    }
    return { success: true, message: `${deletedCount} matching question(s) moved to Trash.`, deletedCount, matchedCount: ids.length, batches };
  }

  private async saveHistory(
    tx: Prisma.TransactionClient,
    question: {
      id: string;
      options: unknown[];
      occurrences: unknown[];
      [key: string]: any;
    },
    changeNote: string,
  ) {
    const latest = await tx.questionHistory.findFirst({
      where: { questionId: question.id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const version = (latest?.version ?? 0) + 1;

    await tx.questionHistory.create({
      data: {
        questionId: question.id,
        version,
        snapshot: question as unknown as Prisma.InputJsonValue,
        changeNote,
      },
    });

    return version;
  }

  async bulkUpdate(dto: BulkUpdateQuestionsDto) {
    const changes = dto.updates;

    if (!changes || Object.keys(changes).every(
      (key) => (changes as Record<string, unknown>)[key] === undefined,
    )) {
      throw new BadRequestException(
        'At least one bulk update field must be provided.',
      );
    }

    if (
      (changes.subjectId && !changes.topicId) ||
      (!changes.subjectId && changes.topicId)
    ) {
      throw new BadRequestException(
        'Subject and Topic must be selected together for bulk changes.',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        const questions = await tx.question.findMany({
          where: {
            id: { in: dto.ids },
            deletedAt: null,
          },
          include: {
            options: { orderBy: { sortOrder: 'asc' } },
            occurrences: true,
          },
        });

        if (questions.length !== dto.ids.length) {
          throw new NotFoundException(
            'One or more selected questions do not exist or are in Trash. No questions were changed.',
          );
        }

        let selectedSubject:
          | { id: string; name: string; isActive: boolean }
          | null = null;

        let selectedTopic:
          | {
              id: string;
              name: string;
              subjectId: string;
              isActive: boolean;
              subject: { id: string; name: string; isActive: boolean };
            }
          | null = null;

        if (changes.subjectId && changes.topicId) {
          selectedSubject = await tx.subject.findFirst({
            where: { id: changes.subjectId, isActive: true },
            select: { id: true, name: true, isActive: true },
          });

          if (!selectedSubject) {
            throw new BadRequestException(
              'Selected Subject does not exist or is inactive.',
            );
          }

          selectedTopic = await tx.topic.findFirst({
            where: { id: changes.topicId, isActive: true },
            include: {
              subject: {
                select: { id: true, name: true, isActive: true },
              },
            },
          });

          if (
            !selectedTopic ||
            !selectedTopic.subject.isActive ||
            selectedTopic.subjectId !== selectedSubject.id
          ) {
            throw new BadRequestException(
              'Selected Topic must be active and belong to the selected Subject.',
            );
          }
        }

        const changeNote =
          changes.changeNote?.trim() ||
          'Bulk update from Question Bank management.';

        const results: Array<{ id: string; version: number }> = [];

        for (const question of questions) {
          const version = await this.saveHistory(
            tx,
            question,
            changeNote,
          );

          const data: Prisma.QuestionUpdateInput = {
            ...(changes.difficulty !== undefined
              ? { difficulty: changes.difficulty }
              : {}),
            ...(changes.status !== undefined
              ? { status: changes.status }
              : {}),
            ...(selectedSubject && selectedTopic
              ? {
                  subject: selectedSubject.name,
                  topic: selectedTopic.name,
                  subjectRef: {
                    connect: { id: selectedSubject.id },
                  },
                  topicRef: {
                    connect: { id: selectedTopic.id },
                  },
                }
              : {}),
          };

          await tx.question.update({
            where: { id: question.id },
            data,
          });

          results.push({ id: question.id, version });
        }

        return {
          success: true,
          message: `${results.length} question(s) updated successfully.`,
          updatedCount: results.length,
          data: results,
        };
      },
      {
        maxWait: 10000,
        timeout: 120000,
      },
    );
  }

  async bulkSoftDelete(ids: string[]) {
    return this.prisma.$transaction(
      async (tx) => {
        const questions = await tx.question.findMany({
          where: {
            id: { in: ids },
            deletedAt: null,
          },
          select: { id: true },
        });

        if (questions.length !== ids.length) {
          throw new NotFoundException(
            'One or more selected questions do not exist or are already in Trash. No questions were deleted.',
          );
        }

        const deletedAt = new Date();

        const result = await tx.question.updateMany({
          where: {
            id: { in: ids },
            deletedAt: null,
          },
          data: { deletedAt },
        });

        if (result.count !== ids.length) {
          throw new BadRequestException(
            'Bulk delete could not safely complete. No questions were changed.',
          );
        }

        return {
          success: true,
          message: `${result.count} question(s) moved to Trash successfully.`,
          deletedCount: result.count,
          data: ids.map((id) => ({ id, deletedAt })),
        };
      },
      {
        maxWait: 10000,
        timeout: 30000,
      },
    );
  }

  async publishAllDrafts() {
    return this.prisma.$transaction(
      async (tx) => {
        const drafts = await tx.question.findMany({
          where: {
            deletedAt: null,
            status: 'DRAFT',
          },
          include: {
            options: { orderBy: { sortOrder: 'asc' } },
            occurrences: true,
          },
          orderBy: { createdAt: 'asc' },
        });

        if (drafts.length === 0) {
          return {
            success: true,
            message: 'There are no active Draft questions to publish.',
            publishedCount: 0,
            data: [],
          };
        }

        const results: Array<{ id: string; version: number }> = [];

        for (const question of drafts) {
          const version = await this.saveHistory(
            tx,
            question,
            'Bulk publish: Draft changed to Published.',
          );

          await tx.question.update({
            where: { id: question.id },
            data: { status: 'PUBLISHED' },
          });

          results.push({ id: question.id, version });
        }

        return {
          success: true,
          message: `${results.length} Draft question(s) published successfully.`,
          publishedCount: results.length,
          data: results,
        };
      },
      {
        maxWait: 10000,
        timeout: 120000,
      },
    );
  }
}