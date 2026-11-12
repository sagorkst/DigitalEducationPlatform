import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

type PublicQuestionFilters = {
  page?: string;
  limit?: string;
  search?: string;
  subjectId?: string;
  topicId?: string;
  institutionId?: string;
  institution?: string;
  examId?: string;
  exam?: string;
  examYear?: string;
  postId?: string;
  post?: string;
  yearFrom?: string;
  yearTo?: string;
  questionType?: string;
  difficulty?: string;
  isRepeated?: string;
};

@Injectable()
export class PublicQuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  private uuid(value: string | undefined, field: string) {
    if (value !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      throw new BadRequestException(`Invalid ${field}.`);
    }
  }

  private buildWhere(query: PublicQuestionFilters): Prisma.QuestionWhereInput {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    if (!Number.isInteger(page) || page < 1 || page > 1000000) throw new BadRequestException('page must be a positive integer within the supported range.');
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BadRequestException('limit must be between 1 and 100.');
    if (query.search && query.search.length > 200) throw new BadRequestException('search must be 200 characters or fewer.');
    for (const [field, value] of [['institution', query.institution], ['exam', query.exam], ['post', query.post]] as const) {
      if (value && value.length > 150) throw new BadRequestException(`${field} must be 150 characters or fewer.`);
    }

    for (const [field, value] of Object.entries({
      subjectId: query.subjectId,
      topicId: query.topicId,
      institutionId: query.institutionId,
      examId: query.examId,
      postId: query.postId,
    })) this.uuid(value, field);

    const yearFrom = query.yearFrom === undefined ? undefined : Number(query.yearFrom);
    const yearTo = query.yearTo === undefined ? undefined : Number(query.yearTo);
    for (const [field, value] of [['yearFrom', yearFrom], ['yearTo', yearTo]] as const) {
      if (value !== undefined && (!Number.isInteger(value) || value < 1900 || value > 2100)) {
        throw new BadRequestException(`${field} must be a year between 1900 and 2100.`);
      }
    }
    if (yearFrom !== undefined && yearTo !== undefined && yearFrom > yearTo) {
      throw new BadRequestException('yearFrom cannot be greater than yearTo.');
    }
    const examYear = query.examYear === undefined ? undefined : Number(query.examYear);
    if (examYear !== undefined && (!Number.isInteger(examYear) || examYear < 1900 || examYear > 2100)) {
      throw new BadRequestException('examYear must be a year between 1900 and 2100.');
    }
    if (query.isRepeated !== undefined && !['true', 'false'].includes(query.isRepeated)) {
      throw new BadRequestException('isRepeated must be true or false.');
    }
    if (query.questionType && !['MCQ', 'TRUE_FALSE', 'FILL_IN_THE_BLANKS', 'WRITTEN'].includes(query.questionType)) {
      throw new BadRequestException('Invalid questionType.');
    }
    if (query.difficulty && !['EASY', 'MEDIUM', 'HARD'].includes(query.difficulty)) {
      throw new BadRequestException('Invalid difficulty.');
    }

    const and: Prisma.QuestionWhereInput[] = [];
    const search = query.search?.trim();
    if (search) {
      and.push({ OR: [
        { questionText: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { topic: { contains: search, mode: 'insensitive' } },
        { questionCode: { contains: search, mode: 'insensitive' } },
      ] });
    }
    if (query.subjectId) and.push({ subjectId: query.subjectId, subjectRef: { isActive: true } });
    if (query.topicId) and.push({ topicId: query.topicId, topicRef: { isActive: true, subject: { isActive: true } } });
    if (query.institutionId || query.institution?.trim() || query.examId || query.exam?.trim() || query.examYear !== undefined || query.postId || query.post?.trim() || yearFrom !== undefined || yearTo !== undefined) {
      and.push({ occurrences: { some: {
        ...(query.institutionId ? { institutionId: query.institutionId } : {}),
        ...(query.institution?.trim() ? { institution: { contains: query.institution.trim(), mode: 'insensitive' } } : {}),
        ...(query.examId ? { examId: query.examId } : {}),
        ...(query.exam?.trim() ? { examName: { contains: query.exam.trim(), mode: 'insensitive' } } : {}),
        ...(examYear !== undefined ? { examYear } : {}),
        ...(query.postId ? { postId: query.postId } : {}),
        ...(query.post?.trim() ? { postName: { contains: query.post.trim(), mode: 'insensitive' } } : {}),
        ...(yearFrom !== undefined || yearTo !== undefined ? { examYear: {
          ...(yearFrom !== undefined ? { gte: yearFrom } : {}),
          ...(yearTo !== undefined ? { lte: yearTo } : {}),
        } } : {}),
      } } });
    }
    if (query.questionType) and.push({ questionType: query.questionType as any });
    if (query.difficulty) and.push({ difficulty: query.difficulty as any });
    if (query.isRepeated === 'true') and.push({ repeatGroupId: { not: null } });
    if (query.isRepeated === 'false') and.push({ repeatGroupId: null });

    and.push(
      { OR: [{ subjectId: null }, { subjectRef: { isActive: true } }] },
      { OR: [{ topicId: null }, { topicRef: { isActive: true, subject: { isActive: true } } }] },
    );
    return {
      status: 'PUBLISHED',
      deletedAt: null,
      AND: and,
    };
  }

  async findAll(query: PublicQuestionFilters) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const where = this.buildWhere(query);
    const [records, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: {
          id: true,
          questionText: true,
          questionType: true,
          subject: true,
          topic: true,
          subjectId: true,
          topicId: true,
          difficulty: true,
          repeatGroupId: true,
          _count: { select: { occurrences: true } },
          options: { orderBy: { sortOrder: 'asc' }, select: { id: true, label: true, optionText: true, sortOrder: true } },
          occurrences: {
            orderBy: { examYear: 'desc' },
            select: {
              institution: true, examName: true, examYear: true,
              postName: true, department: true, questionNumber: true,
              source: true, sourcePage: true,
              institutionRef: { select: { id: true, name: true } },
              examRef: { select: { id: true, name: true, examYear: true } },
              postRef: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.question.count({ where }),
    ]);
    const repeatIds = [...new Set(records.map((q) => q.repeatGroupId).filter((id): id is string => Boolean(id)))];
    const repeatRows = repeatIds.length ? await this.prisma.question.findMany({
      where: {
        status: 'PUBLISHED', deletedAt: null, repeatGroupId: { in: repeatIds },
        AND: [
          { OR: [{ subjectId: null }, { subjectRef: { isActive: true } }] },
          { OR: [{ topicId: null }, { topicRef: { isActive: true, subject: { isActive: true } } }] },
        ],
      },
      select: { repeatGroupId: true, _count: { select: { occurrences: true } } },
    }) : [];
    const repeatCounts = new Map<string, number>();
    for (const row of repeatRows) {
      if (row.repeatGroupId) repeatCounts.set(row.repeatGroupId, (repeatCounts.get(row.repeatGroupId) ?? 0) + row._count.occurrences);
    }
    return {
      success: true,
      data: records.map((q) => ({
        ...q,
        isRepeated: Boolean(q.repeatGroupId),
        occurrenceCount: q.repeatGroupId ? (repeatCounts.get(q.repeatGroupId) ?? q.occurrences.length) : q.occurrences.length,
      })),
      pagination: {
        total, page, limit, totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string) {
    this.uuid(id, 'id');
    const question = await this.prisma.question.findFirst({
      where: {
        id, status: 'PUBLISHED', deletedAt: null,
        AND: [
          { OR: [{ subjectId: null }, { subjectRef: { isActive: true } }] },
          { OR: [{ topicId: null }, { topicRef: { isActive: true, subject: { isActive: true } } }] },
        ],
      },
      select: {
        id: true, questionText: true, questionType: true,
        subject: true, topic: true, subjectId: true, topicId: true,
        correctAnswer: true, explanation: true, difficulty: true,
        repeatGroupId: true,
        createdAt: true,
        options: { orderBy: { sortOrder: 'asc' }, select: { id: true, label: true, optionText: true, isCorrect: true, sortOrder: true } },
        occurrences: {
          orderBy: { examYear: 'desc' },
          select: {
            institution: true, examName: true, examYear: true,
            postName: true, department: true, questionNumber: true,
            source: true, sourcePage: true, sourceUrl: true,
            institutionRef: { select: { id: true, name: true } },
            examRef: { select: { id: true, name: true, examYear: true } },
            postRef: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!question) throw new NotFoundException('Question not found.');
    let related: { id: string; questionText: string; subject: string; topic: string }[] = [];
    if (question.repeatGroupId) {
      related = await this.prisma.question.findMany({
        where: {
          status: 'PUBLISHED', deletedAt: null, repeatGroupId: question.repeatGroupId, id: { not: id },
          AND: [
            { OR: [{ subjectId: null }, { subjectRef: { isActive: true } }] },
            { OR: [{ topicId: null }, { topicRef: { isActive: true, subject: { isActive: true } } }] },
          ],
        },
        take: 5, orderBy: { createdAt: 'desc' },
        select: { id: true, questionText: true, subject: true, topic: true },
      });
    }
    let occurrenceCount = question.occurrences.length;
    if (question.repeatGroupId) {
      const group = await this.prisma.question.findMany({
        where: {
          status: 'PUBLISHED', deletedAt: null, repeatGroupId: question.repeatGroupId,
          AND: [
            { OR: [{ subjectId: null }, { subjectRef: { isActive: true } }] },
            { OR: [{ topicId: null }, { topicRef: { isActive: true, subject: { isActive: true } } }] },
          ],
        },
        select: { _count: { select: { occurrences: true } } },
      });
      occurrenceCount = group.reduce((sum, item) => sum + item._count.occurrences, 0);
    }
    const activePublished: Prisma.QuestionWhereInput = {
      status: 'PUBLISHED', deletedAt: null,
      AND: [
        { OR: [{ subjectId: null }, { subjectRef: { isActive: true } }] },
        { OR: [{ topicId: null }, { topicRef: { isActive: true, subject: { isActive: true } } }] },
      ],
    };
    const [previous, next] = await Promise.all([
      this.prisma.question.findFirst({
        where: { ...activePublished, OR: [
          { createdAt: { gt: question.createdAt } },
          { createdAt: question.createdAt, id: { lt: id } },
        ] },
        orderBy: [{ createdAt: 'asc' }, { id: 'desc' }],
        select: { id: true },
      }),
      this.prisma.question.findFirst({
        where: { ...activePublished, OR: [
          { createdAt: { lt: question.createdAt } },
          { createdAt: question.createdAt, id: { gt: id } },
        ] },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: { id: true },
      }),
    ]);
    return {
      success: true,
      data: {
        ...question,
        isRepeated: Boolean(question.repeatGroupId),
        occurrenceCount,
        relatedQuestions: related,
        previousQuestionId: previous?.id ?? null,
        nextQuestionId: next?.id ?? null,
      },
    };
  }

  async subjects() {
    const data = await this.prisma.subject.findMany({
      where: { isActive: true, questions: { some: {
        status: 'PUBLISHED', deletedAt: null,
        OR: [{ topicId: null }, { topicRef: { isActive: true } }],
      } } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, description: true, _count: { select: { questions: { where: { status: 'PUBLISHED', deletedAt: null } } } } },
    });
    return { success: true, data };
  }

  async topics(subjectId?: string) {
    this.uuid(subjectId, 'subjectId');
    const data = await this.prisma.topic.findMany({
      where: {
        isActive: true, subject: { isActive: true },
        ...(subjectId ? { subjectId } : {}),
        questions: { some: { status: 'PUBLISHED', deletedAt: null } },
      },
      orderBy: [{ subject: { name: 'asc' } }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, subjectId: true, parentId: true, subject: { select: { id: true, name: true } }, _count: { select: { questions: { where: { status: 'PUBLISHED', deletedAt: null } } } } },
    });
    return { success: true, data };
  }

  async filterOptions() {
    const occurrenceScope: Prisma.QuestionOccurrenceWhereInput = {
      question: {
        status: 'PUBLISHED',
        deletedAt: null,
        AND: [
          { OR: [{ subjectId: null }, { subjectRef: { isActive: true } }] },
          { OR: [{ topicId: null }, { topicRef: { isActive: true, subject: { isActive: true } } }] },
        ],
      },
    };
    const [institutions, exams, posts, years, topics] = await Promise.all([
      this.prisma.questionOccurrence.findMany({
        where: occurrenceScope,
        distinct: ['institution'],
        orderBy: { institution: 'asc' },
        select: { institution: true },
      }),
      this.prisma.questionOccurrence.findMany({
        where: occurrenceScope,
        distinct: ['examName', 'examYear'],
        orderBy: [{ examYear: 'desc' }, { examName: 'asc' }],
        select: { examName: true, examYear: true },
      }),
      this.prisma.questionOccurrence.findMany({
        where: { ...occurrenceScope, postName: { not: null } },
        distinct: ['postName'],
        orderBy: { postName: 'asc' },
        select: { postName: true },
      }),
      this.prisma.questionOccurrence.findMany({
        where: occurrenceScope,
        distinct: ['examYear'],
        orderBy: { examYear: 'desc' },
        select: { examYear: true },
      }),
      this.prisma.topic.findMany({
        where: {
          isActive: true,
          subject: { isActive: true },
          questions: { some: { status: 'PUBLISHED', deletedAt: null } },
        },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, subjectId: true, subject: { select: { name: true } } },
      }),
    ]);
    return {
      success: true,
      data: {
        institutions: institutions.filter((item) => item.institution.trim()).map((item) => ({ id: item.institution, name: item.institution })),
        exams: exams.filter((item) => item.examName.trim()).map((item) => ({ id: `${item.examName}-${item.examYear}`, name: item.examName, examYear: item.examYear })),
        posts: posts.filter((item) => item.postName?.trim()).map((item) => ({ id: item.postName as string, name: item.postName as string })),
        years: years.map((item) => item.examYear),
        topics,
      },
    };
  }
}
