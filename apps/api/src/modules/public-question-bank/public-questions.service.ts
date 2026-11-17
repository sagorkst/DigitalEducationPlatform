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
  grade?: string;
  examType?: string;
  hasAnswer?: string;
  hasExplanation?: string;
  yearFrom?: string;
  yearTo?: string;
  questionType?: string;
  difficulty?: string;
  isRepeated?: string;
  sort?: string;
};

type PublicExamFilters = {
  search?: string;
  institutionId?: string;
  postId?: string;
  examId?: string;
  grade?: string;
  examType?: string;
  hasAnswer?: string;
  hasExplanation?: string;
  examYear?: string;
  yearFrom?: string;
  yearTo?: string;
  subjectId?: string;
  topicId?: string;
  difficulty?: string;
  questionType?: string;
};

@Injectable()
export class PublicQuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  private uuid(value: string | undefined, field: string) {
    if (
      value !== undefined &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ) {
      throw new BadRequestException(`Invalid ${field}.`);
    }
  }

  private activePublishedWhere(): Prisma.QuestionWhereInput {
    return {
      status: 'PUBLISHED',
      deletedAt: null,
      AND: [
        { OR: [{ subjectId: null }, { subjectRef: { isActive: true } }] },
        {
          OR: [
            { topicId: null },
            { topicRef: { isActive: true, subject: { isActive: true } } },
          ],
        },
      ],
    };
  }

  private validateQuestionFilters(query: {
    subjectId?: string;
    topicId?: string;
    difficulty?: string;
    questionType?: string;
  }) {
    this.uuid(query.subjectId, 'subjectId');
    this.uuid(query.topicId, 'topicId');

    if (
      query.questionType &&
      !['MCQ', 'TRUE_FALSE', 'FILL_IN_THE_BLANKS', 'WRITTEN'].includes(
        query.questionType,
      )
    ) {
      throw new BadRequestException('Invalid questionType.');
    }

    if (
      query.difficulty &&
      !['EASY', 'MEDIUM', 'HARD'].includes(query.difficulty)
    ) {
      throw new BadRequestException('Invalid difficulty.');
    }
  }

  private buildWhere(
    query: PublicQuestionFilters,
  ): Prisma.QuestionWhereInput {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 1000000
    ) {
      throw new BadRequestException(
        'page must be a positive integer within the supported range.',
      );
    }

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      throw new BadRequestException(
        'limit must be between 1 and 100.',
      );
    }


    if (query.search && query.search.length > 200) {
      throw new BadRequestException(
        'search must be 200 characters or fewer.',
      );
    }

    for (const [field, value] of [
      ['institution', query.institution],
      ['exam', query.exam],
      ['post', query.post],
      ['grade', query.grade],
      ['examType', query.examType],
    ] as const) {
      if (value && value.length > 150) {
        throw new BadRequestException(
          `${field} must be 150 characters or fewer.`,
        );
      }
    }

    for (const [field, value] of Object.entries({
      subjectId: query.subjectId,
      topicId: query.topicId,
      institutionId: query.institutionId,
      examId: query.examId,
      postId: query.postId,
    })) {
      this.uuid(value, field);
    }

    this.validateQuestionFilters(query);

    const yearFrom =
      query.yearFrom === undefined ? undefined : Number(query.yearFrom);
    const yearTo =
      query.yearTo === undefined ? undefined : Number(query.yearTo);

    for (const [field, value] of [
      ['yearFrom', yearFrom],
      ['yearTo', yearTo],
    ] as const) {
      if (
        value !== undefined &&
        (!Number.isInteger(value) || value < 1900 || value > 2100)
      ) {
        throw new BadRequestException(
          `${field} must be a year between 1900 and 2100.`,
        );
      }
    }

    if (
      yearFrom !== undefined &&
      yearTo !== undefined &&
      yearFrom > yearTo
    ) {
      throw new BadRequestException(
        'yearFrom cannot be greater than yearTo.',
      );
    }

    const examYear =
      query.examYear === undefined ? undefined : Number(query.examYear);

    if (
      examYear !== undefined &&
      (!Number.isInteger(examYear) ||
        examYear < 1900 ||
        examYear > 2100)
    ) {
      throw new BadRequestException(
        'examYear must be a year between 1900 and 2100.',
      );
    }

    if (
      query.isRepeated !== undefined &&
      !['true', 'false'].includes(query.isRepeated)
    ) {
      throw new BadRequestException('isRepeated must be true or false.');
    }

    for (const [field, value] of [['hasAnswer', query.hasAnswer], ['hasExplanation', query.hasExplanation]] as const) {
      if (value !== undefined && !['true', 'false'].includes(value)) {
        throw new BadRequestException(`${field} must be true or false.`);
      }
    }

    const and: Prisma.QuestionWhereInput[] = [];
    const search = query.search?.trim();

    if (search) {
      and.push({
        OR: [
          { questionText: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } },
          { topic: { contains: search, mode: 'insensitive' } },
          { questionCode: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (query.subjectId) {
      and.push({
        subjectId: query.subjectId,
        subjectRef: { isActive: true },
      });
    }

    if (query.topicId) {
      and.push({
        topicId: query.topicId,
        topicRef: {
          isActive: true,
          subject: { isActive: true },
        },
      });
    }

    if (
      query.institutionId ||
      query.institution?.trim() ||
      query.examId ||
      query.exam?.trim() ||
      examYear !== undefined ||
      query.postId ||
      query.post?.trim() ||
      query.grade?.trim() ||
      query.examType?.trim() ||
      yearFrom !== undefined ||
      yearTo !== undefined
    ) {
      and.push({
        occurrences: {
          some: {
            ...(query.institutionId
              ? { institutionId: query.institutionId }
              : {}),
            ...(query.institution?.trim()
              ? {
                  institution: {
                    contains: query.institution.trim(),
                    mode: 'insensitive',
                  },
                }
              : {}),
            ...(query.examId ? { examId: query.examId } : {}),
            ...(query.exam?.trim()
              ? {
                  examName: {
                    contains: query.exam.trim(),
                    mode: 'insensitive',
                  },
                }
              : {}),
            ...(examYear !== undefined ? { examYear } : {}),
            ...(query.postId ? { postId: query.postId } : {}),
            ...(query.post?.trim()
              ? {
                  postName: {
                    contains: query.post.trim(),
                    mode: 'insensitive',
                  },
                }
              : {}),
            ...(query.grade?.trim() || query.examType?.trim()
              ? {
                  examRef: {
                    ...(query.grade?.trim()
                      ? { grade: { equals: query.grade.trim(), mode: 'insensitive' } }
                      : {}),
                    ...(query.examType?.trim()
                      ? { examType: { equals: query.examType.trim(), mode: 'insensitive' } }
                      : {}),
                  },
                }
              : {}),
            ...(yearFrom !== undefined && yearTo !== undefined
              ? { examYear: { gte: yearFrom, lte: yearTo } }
              : yearFrom !== undefined || yearTo !== undefined
                ? { examYear: { equals: yearFrom ?? yearTo } }
                : {}),
          },
        },
      });
    }

    if (query.questionType) {
      and.push({ questionType: query.questionType as any });
    }

    if (query.difficulty) {
      and.push({ difficulty: query.difficulty as any });
    }

    if (query.isRepeated === 'true') {
      and.push({ repeatGroupId: { not: null } });
    }

    if (query.isRepeated === 'false') {
      and.push({ repeatGroupId: null });
    }

    if (query.hasAnswer === 'true') {
      and.push({ OR: [{ correctAnswer: { not: null } }, { options: { some: { isCorrect: true } } }] });
    } else if (query.hasAnswer === 'false') {
      and.push({ correctAnswer: null, options: { none: { isCorrect: true } } });
    }

    if (query.hasExplanation === 'true') {
      and.push({ explanation: { not: null } });
    } else if (query.hasExplanation === 'false') {
      and.push({ explanation: null });
    }

    and.push(
      { OR: [{ subjectId: null }, { subjectRef: { isActive: true } }] },
      {
        OR: [
          { topicId: null },
          { topicRef: { isActive: true, subject: { isActive: true } } },
        ],
      },
    );

    return {
      status: 'PUBLISHED',
      deletedAt: null,
      AND: and,
    };
  }

  async exams(query: PublicExamFilters) {
    for (const [field, value] of Object.entries({
      institutionId: query.institutionId,
      postId: query.postId,
      examId: query.examId,
    })) {
      this.uuid(value, field);
    }

    this.validateQuestionFilters(query);


    if (query.search && query.search.length > 200) {
      throw new BadRequestException(
        'search must be 200 characters or fewer.',
      );
    }

    const examYear =
      query.examYear === undefined ? undefined : Number(query.examYear);

    if (
      examYear !== undefined &&
      (!Number.isInteger(examYear) ||
        examYear < 1900 ||
        examYear > 2100)
    ) {
      throw new BadRequestException(
        'examYear must be a year between 1900 and 2100.',
      );
    }

    const yearFrom =
      query.yearFrom === undefined ? undefined : Number(query.yearFrom);
    const yearTo =
      query.yearTo === undefined ? undefined : Number(query.yearTo);

    for (const [field, value] of [
      ['yearFrom', yearFrom],
      ['yearTo', yearTo],
    ] as const) {
      if (
        value !== undefined &&
        (!Number.isInteger(value) || value < 1900 || value > 2100)
      ) {
        throw new BadRequestException(
          `${field} must be a year between 1900 and 2100.`,
        );
      }
    }

    if (
      yearFrom !== undefined &&
      yearTo !== undefined &&
      yearFrom > yearTo
    ) {
      throw new BadRequestException(
        'yearFrom cannot be greater than yearTo.',
      );
    }

    const questionWhere: Prisma.QuestionWhereInput = {
      ...this.activePublishedWhere(),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.topicId ? { topicId: query.topicId } : {}),
      ...(query.difficulty
        ? { difficulty: query.difficulty as any }
        : {}),
      ...(query.questionType
        ? { questionType: query.questionType as any }
        : {}),
      ...(query.hasAnswer === 'true'
        ? { OR: [{ correctAnswer: { not: null } }, { options: { some: { isCorrect: true } } }] }
        : query.hasAnswer === 'false'
          ? { correctAnswer: null, options: { none: { isCorrect: true } } }
          : {}),
      ...(query.hasExplanation === 'true'
        ? { explanation: { not: null } }
        : query.hasExplanation === 'false'
          ? { explanation: null }
          : {}),
    };

    const search = query.search?.trim();

    const where: Prisma.ExamWhereInput = {
      ...(query.examId ? { id: query.examId } : {}),
      ...(query.institutionId
        ? { institutionId: query.institutionId }
        : {}),
      ...(query.postId ? { postId: query.postId } : {}),
      ...(query.grade?.trim()
        ? { grade: { equals: query.grade.trim(), mode: 'insensitive' } }
        : {}),
      ...(query.examType?.trim()
        ? { examType: { equals: query.examType.trim(), mode: 'insensitive' } }
        : {}),
      ...(examYear !== undefined
        ? { examYear }
        : yearFrom !== undefined && yearTo !== undefined
          ? { examYear: { gte: yearFrom, lte: yearTo } }
          : yearFrom !== undefined || yearTo !== undefined
            ? { examYear: { equals: yearFrom ?? yearTo } }
            : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { examType: { contains: search, mode: 'insensitive' } },
              {
                institution: {
                  name: { contains: search, mode: 'insensitive' },
                },
              },
              {
                post: {
                  name: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
      occurrences: {
        some: {
          question: questionWhere,
        },
      },
    };

    const exams = await this.prisma.exam.findMany({
      where,
      orderBy: [
        { examYear: 'desc' },
        { name: 'asc' },
        { createdAt: 'desc' },
      ],
      take: 500,
      select: {
        id: true,
        name: true,
        slug: true,
        examYear: true,
        examType: true,
        grade: true,
        institutionId: true,
        postId: true,
        institution: {
          select: { id: true, name: true },
        },
        post: {
          select: { id: true, name: true },
        },
      },
    });

    if (exams.length === 0) {
      return {
        success: true,
        data: [],
        pagination: { total: 0, limit: 500 },
      };
    }

    const examIds = exams.map((exam) => exam.id);

    const occurrenceRows = await this.prisma.questionOccurrence.findMany({
      where: {
        examId: { in: examIds },
        question: questionWhere,
      },
      select: {
        examId: true,
        questionId: true,
      },
    });

    const counts = new Map<string, Set<string>>();

    for (const row of occurrenceRows) {
      if (!row.examId) continue;

      if (!counts.has(row.examId)) {
        counts.set(row.examId, new Set<string>());
      }

      counts.get(row.examId)!.add(row.questionId);
    }

    return {
      success: true,
      data: exams
        .map((exam) => ({
          ...exam,
          questionCount: counts.get(exam.id)?.size ?? 0,
        }))
        .filter((exam) => exam.questionCount > 0),
      pagination: {
        total: exams.length,
        limit: 500,
      },
    };
  }

  async findAll(query: PublicQuestionFilters) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const where = this.buildWhere(query);

    const selectedExamYear =
      query.examYear === undefined ? undefined : Number(query.examYear);
    const selectedYearFrom =
      query.yearFrom === undefined ? undefined : Number(query.yearFrom);
    const selectedYearTo =
      query.yearTo === undefined ? undefined : Number(query.yearTo);

    const occurrenceSelectWhere: Prisma.QuestionOccurrenceWhereInput = {
      ...(query.examId ? { examId: query.examId } : {}),
      ...(query.institutionId ? { institutionId: query.institutionId } : {}),
      ...(query.institution?.trim()
        ? { institution: { contains: query.institution.trim(), mode: 'insensitive' } }
        : {}),
      ...(query.exam?.trim()
        ? { examName: { contains: query.exam.trim(), mode: 'insensitive' } }
        : {}),
      ...(query.postId ? { postId: query.postId } : {}),
      ...(query.grade?.trim() || query.examType?.trim()
        ? {
            examRef: {
              ...(query.grade?.trim()
                ? { grade: { equals: query.grade.trim(), mode: 'insensitive' } }
                : {}),
              ...(query.examType?.trim()
                ? { examType: { equals: query.examType.trim(), mode: 'insensitive' } }
                : {}),
            },
          }
        : {}),
      ...(query.post?.trim()
        ? { postName: { contains: query.post.trim(), mode: 'insensitive' } }
        : {}),
      ...(selectedExamYear !== undefined
        ? { examYear: selectedExamYear }
        : selectedYearFrom !== undefined && selectedYearTo !== undefined
          ? { examYear: { gte: selectedYearFrom, lte: selectedYearTo } }
          : selectedYearFrom !== undefined || selectedYearTo !== undefined
            ? { examYear: selectedYearFrom ?? selectedYearTo }
            : {}),
    };

    const [records, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy:
          query.sort === 'az'
            ? [{ questionText: 'asc' }, { id: 'asc' }]
            : query.sort === 'za'
              ? [{ questionText: 'desc' }, { id: 'asc' }]
              : [{ createdAt: 'desc' }, { id: 'asc' }],
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
          _count: { select: { occurrences: { where: occurrenceSelectWhere } } },
          options: {
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              label: true,
              optionText: true,
              sortOrder: true,
            },
          },
          occurrences: {
            where: occurrenceSelectWhere,
            orderBy: { examYear: 'desc' },
            select: {
              institution: true,
              examName: true,
              examYear: true,
              postName: true,
              department: true,
              questionNumber: true,
              source: true,
              sourcePage: true,
              institutionRef: { select: { id: true, name: true } },
              examRef: {
                select: {
                  id: true,
                  name: true,
                  examYear: true,
                  examType: true,
                },
              },
              postRef: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.question.count({ where }),
    ]);

    const repeatIds = [
      ...new Set(
        records
          .map((question) => question.repeatGroupId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const repeatRows = repeatIds.length
      ? await this.prisma.question.findMany({
          where: {
            ...this.activePublishedWhere(),
            repeatGroupId: { in: repeatIds },
          },
          select: {
            repeatGroupId: true,
            _count: { select: { occurrences: { where: occurrenceSelectWhere } } },
          },
        })
      : [];

    const repeatCounts = new Map<string, number>();

    for (const row of repeatRows) {
      if (row.repeatGroupId) {
        repeatCounts.set(
          row.repeatGroupId,
          (repeatCounts.get(row.repeatGroupId) ?? 0) +
            row._count.occurrences,
        );
      }
    }

    return {
      success: true,
      data: records.map((question) => ({
        ...question,
        isRepeated: Boolean(question.repeatGroupId),
        occurrenceCount: question.repeatGroupId
          ? repeatCounts.get(question.repeatGroupId) ??
            question.occurrences.length
          : question.occurrences.length,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string, examId?: string) {
    this.uuid(id, 'id');
    this.uuid(examId, 'examId');

    const examScope: Prisma.QuestionWhereInput = examId
      ? {
          occurrences: {
            some: { examId },
          },
        }
      : {};

    const question = await this.prisma.question.findFirst({
      where: {
        id,
        ...this.activePublishedWhere(),
        ...examScope,
      },
      select: {
        id: true,
        questionText: true,
        questionType: true,
        subject: true,
        topic: true,
        subjectId: true,
        topicId: true,
        correctAnswer: true,
        explanation: true,
        difficulty: true,
        repeatGroupId: true,
        createdAt: true,
        options: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            label: true,
            optionText: true,
            isCorrect: true,
            sortOrder: true,
          },
        },
        occurrences: {
          ...(examId ? { where: { examId } } : {}),
          orderBy: { examYear: 'desc' },
          select: {
            institution: true,
            examName: true,
            examYear: true,
            postName: true,
            department: true,
            questionNumber: true,
            source: true,
            sourcePage: true,
            sourceUrl: true,
            institutionRef: { select: { id: true, name: true } },
            examRef: {
              select: {
                id: true,
                name: true,
                examYear: true,
                examType: true,
              },
            },
            postRef: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!question) {
      throw new NotFoundException('Question not found.');
    }

    let related: {
      id: string;
      questionText: string;
      subject: string;
      topic: string;
    }[] = [];

    if (question.repeatGroupId) {
      related = await this.prisma.question.findMany({
        where: {
          ...this.activePublishedWhere(),
          repeatGroupId: question.repeatGroupId,
          id: { not: id },
          ...(examId
            ? {
                occurrences: {
                  some: { examId },
                },
              }
            : {}),
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          questionText: true,
          subject: true,
          topic: true,
        },
      });
    }

    let occurrenceCount = question.occurrences.length;

    if (question.repeatGroupId) {
      const group = await this.prisma.question.findMany({
        where: {
          ...this.activePublishedWhere(),
          repeatGroupId: question.repeatGroupId,
          ...(examId
            ? {
                occurrences: {
                  some: { examId },
                },
              }
            : {}),
        },
        select: {
          _count: {
            select: {
              occurrences: examId
                ? { where: { examId } }
                : true,
            },
          },
        },
      });

      occurrenceCount = group.reduce(
        (sum, item) => sum + item._count.occurrences,
        0,
      );
    }

    const activePublished = this.activePublishedWhere();

    const navigationScope: Prisma.QuestionWhereInput = examId
      ? {
          occurrences: {
            some: { examId },
          },
        }
      : {};

    const [previous, next] = await Promise.all([
      this.prisma.question.findFirst({
        where: {
          ...activePublished,
          ...navigationScope,
          OR: [
            { createdAt: { gt: question.createdAt } },
            { createdAt: question.createdAt, id: { lt: id } },
          ],
        },
        orderBy: [
          { createdAt: 'asc' },
          { id: 'desc' },
        ],
        select: { id: true },
      }),
      this.prisma.question.findFirst({
        where: {
          ...activePublished,
          ...navigationScope,
          OR: [
            { createdAt: { lt: question.createdAt } },
            { createdAt: question.createdAt, id: { gt: id } },
          ],
        },
        orderBy: [
          { createdAt: 'desc' },
          { id: 'asc' },
        ],
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
        examId: examId ?? null,
      },
    };
  }

  async subjects() {
    const data = await this.prisma.subject.findMany({
      where: {
        isActive: true,
        questions: {
          some: {
            status: 'PUBLISHED',
            deletedAt: null,
            OR: [{ topicId: null }, { topicRef: { isActive: true } }],
          },
        },
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        _count: {
          select: {
            questions: {
              where: { status: 'PUBLISHED', deletedAt: null },
            },
          },
        },
      },
    });

    return { success: true, data };
  }

  async topics(subjectId?: string) {
    this.uuid(subjectId, 'subjectId');

    const data = await this.prisma.topic.findMany({
      where: {
        isActive: true,
        subject: { isActive: true },
        ...(subjectId ? { subjectId } : {}),
        questions: {
          some: {
            status: 'PUBLISHED',
            deletedAt: null,
          },
        },
      },
      orderBy: [
        { subject: { name: 'asc' } },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        slug: true,
        subjectId: true,
        parentId: true,
        subject: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            questions: {
              where: { status: 'PUBLISHED', deletedAt: null },
            },
          },
        },
      },
    });

    return { success: true, data };
  }

  async filterOptions() {
    const occurrenceScope: Prisma.QuestionOccurrenceWhereInput = {
      question: this.activePublishedWhere(),
    };

    const [
      institutions,
      exams,
      posts,
      years,
      topics,
      totalQuestions,
      totalSubjects,
      totalTopics,
    ] = await Promise.all([
      this.prisma.questionOccurrence.findMany({
        where: occurrenceScope,
        distinct: ['institution'],
        orderBy: { institution: 'asc' },
        select: { institution: true },
      }),
      this.prisma.exam.findMany({
        where: {
          occurrences: {
            some: {
              question: this.activePublishedWhere(),
            },
          },
        },
        orderBy: [
          { examYear: 'desc' },
          { name: 'asc' },
        ],
        select: {
          id: true,
          name: true,
          examYear: true,
          examType: true,
          grade: true,
          institution: {
            select: { id: true, name: true },
          },
          post: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.questionOccurrence.findMany({
        where: {
          ...occurrenceScope,
          postName: { not: null },
        },
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
          questions: {
            some: {
              status: 'PUBLISHED',
              deletedAt: null,
            },
          },
        },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          subjectId: true,
          parentId: true,
          subject: {
            select: { name: true },
          },
        },
      }),
      this.prisma.question.count({ where: this.activePublishedWhere() }),
      this.prisma.subject.count({
        where: { isActive: true, questions: { some: this.activePublishedWhere() } },
      }),
      this.prisma.topic.count({
        where: { isActive: true, subject: { isActive: true }, questions: { some: this.activePublishedWhere() } },
      }),
    ]);

    return {
      success: true,
      data: {
        summary: {
          questions: totalQuestions,
          exams: exams.length,
          institutions: new Set(exams.map((exam) => exam.institution?.id).filter((id): id is string => Boolean(id))).size,
          subjects: totalSubjects,
          topics: totalTopics,
        },
        examTypes: [...new Set(exams.map((exam) => exam.examType).filter((value): value is string => Boolean(value?.trim())))].sort(),
        institutions: institutions
          .filter((item) => item.institution.trim())
          .map((item) => ({
            id: item.institution,
            name: item.institution,
          })),
        exams: exams.map((exam) => ({
          id: exam.id,
          name: exam.name,
          examYear: exam.examYear,
          examType: exam.examType,
          grade: exam.grade,
          institution: exam.institution,
          post: exam.post,
        })),
        posts: posts
          .filter((item) => item.postName?.trim())
          .map((item) => ({
            id: item.postName as string,
            name: item.postName as string,
          })),
        years: years.map((item) => item.examYear),
        topics,
      },
    };
  }
}




