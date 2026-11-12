import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [
      totalQuestions,
      deletedQuestions,
      statusGroups,
      subjectCount,
      topicCount,
      totalOccurrences,
      totalReviews,
      totalDuplicates,
      totalImportBatches,
    ] = await Promise.all([
      this.prisma.question.count({ where: { deletedAt: null } }),
      this.prisma.question.count({ where: { deletedAt: { not: null } } }),
      this.prisma.question.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.subject.count(),
      this.prisma.topic.count(),
      this.prisma.questionOccurrence.count(),
      this.prisma.questionReview.count(),
      this.prisma.duplicateCandidate.count(),
      this.prisma.importBatch.count(),
    ]);

    const statusCounts = Object.fromEntries(
      statusGroups.map((item) => [item.status, item._count._all]),
    );

    return {
      success: true,
      data: {
        questions: {
          total: totalQuestions,
          deleted: deletedQuestions,
          draft: statusCounts['DRAFT'] ?? 0,
          published: statusCounts['PUBLISHED'] ?? 0,
          hidden: statusCounts['HIDDEN'] ?? 0,
          archived: statusCounts['ARCHIVED'] ?? 0,
        },
        subjects: subjectCount,
        topics: topicCount,
        occurrences: totalOccurrences,
        reviews: totalReviews,
        duplicates: totalDuplicates,
        importBatches: totalImportBatches,
      },
    };
  }

  async questionsBySubject() {
    const subjects = await this.prisma.subject.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            questions: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    return {
      success: true,
      data: subjects.map((subject) => ({
        id: subject.id,
        name: subject.name,
        slug: subject.slug,
        isActive: subject.isActive,
        questionCount: subject._count.questions,
      })),
    };
  }

  async questionsByTopic() {
    const topics = await this.prisma.topic.findMany({
      orderBy: [{ subjectId: 'asc' }, { name: 'asc' }],
      include: {
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            questions: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    return {
      success: true,
      data: topics.map((topic) => ({
        id: topic.id,
        name: topic.name,
        slug: topic.slug,
        subject: topic.subject,
        isActive: topic.isActive,
        questionCount: topic._count.questions,
      })),
    };
  }

  async questionsByExam() {
    const groups = await this.prisma.questionOccurrence.groupBy({
      by: ['institution', 'examName', 'examYear'],
      _count: { _all: true },
      orderBy: [
        { examYear: 'desc' },
        { examName: 'asc' },
      ],
    });

    return {
      success: true,
      data: groups.map((item) => ({
        institution: item.institution,
        examName: item.examName,
        examYear: item.examYear,
        questionCount: item._count._all,
      })),
      meta: {
        totalGroups: groups.length,
      },
    };
  }

  async reviewReport() {
    const [groups, total] = await Promise.all([
      this.prisma.questionReview.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.questionReview.count(),
    ]);

    return {
      success: true,
      data: groups.map((item) => ({
        status: item.status,
        count: item._count._all,
      })),
      meta: { total },
    };
  }

  async duplicateReport() {
    const [groups, total] = await Promise.all([
      this.prisma.duplicateCandidate.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.duplicateCandidate.count(),
    ]);

    return {
      success: true,
      data: groups.map((item) => ({
        status: item.status,
        count: item._count._all,
      })),
      meta: { total },
    };
  }

  async importReport() {
    const [batchGroups, rowGroups, totalBatches, totalRows] =
      await Promise.all([
        this.prisma.importBatch.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        this.prisma.importRow.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        this.prisma.importBatch.count(),
        this.prisma.importRow.count(),
      ]);

    return {
      success: true,
      data: {
        batches: batchGroups.map((item) => ({
          status: item.status,
          count: item._count._all,
        })),
        rows: rowGroups.map((item) => ({
          status: item.status,
          count: item._count._all,
        })),
      },
      meta: {
        totalBatches,
        totalRows,
      },
    };
  }

  async questionQuality() {
    const [
      total,
      withAnswer,
      withoutAnswer,
      withExplanation,
      withoutExplanation,
    ] = await Promise.all([
      this.prisma.question.count({
        where: { deletedAt: null },
      }),
      this.prisma.question.count({
        where: {
          deletedAt: null,
          correctAnswer: { not: null },
          NOT: { correctAnswer: '' },
        },
      }),
      this.prisma.question.count({
        where: {
          deletedAt: null,
          OR: [
            { correctAnswer: null },
            { correctAnswer: '' },
          ],
        },
      }),
      this.prisma.question.count({
        where: {
          deletedAt: null,
          explanation: { not: null },
          NOT: { explanation: '' },
        },
      }),
      this.prisma.question.count({
        where: {
          deletedAt: null,
          OR: [
            { explanation: null },
            { explanation: '' },
          ],
        },
      }),
    ]);

    return {
      success: true,
      data: {
        total,
        answers: {
          withAnswer,
          withoutAnswer,
        },
        explanations: {
          withExplanation,
          withoutExplanation,
        },
      },
    };
  }
}
