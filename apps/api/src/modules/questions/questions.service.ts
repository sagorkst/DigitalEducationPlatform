
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { randomBytes } from 'crypto';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // CREATE QUESTION
  // ==========================================

  async create(dto: CreateQuestionDto) {
    const questionType = dto.questionType ?? 'MCQ';

    if (
      questionType === 'MCQ' &&
      (!dto.options || dto.options.length < 2)
    ) {
      throw new BadRequestException(
        'MCQ questions must have at least two options.',
      );
    }

    if (questionType === 'MCQ') {
      const correctOptions =
        dto.options?.filter((option) => option.isCorrect) ?? [];

      if (correctOptions.length !== 1) {
        throw new BadRequestException(
          'MCQ questions must have exactly one correct option.',
        );
      }
    }

    const questionCode = `Q-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;

    const question = await this.prisma.$transaction(async (tx) => {
      return tx.question.create({
        data: {
          questionCode,
          questionText: dto.questionText,
          questionType,
          subject: dto.subject,
          topic: dto.topic,
          correctAnswer: dto.correctAnswer,
          explanation: dto.explanation,
          difficulty: dto.difficulty ?? 'MEDIUM',
          status: dto.status ?? 'DRAFT',

          options: {
            create: (dto.options ?? []).map((option) => ({
              label: option.label,
              optionText: option.optionText,
              isCorrect: option.isCorrect ?? false,
              sortOrder: option.sortOrder ?? 0,
            })),
          },

          occurrences: {
            create: dto.occurrences.map((occurrence) => ({
              institution: occurrence.institution,
              examName: occurrence.examName,
              examYear: occurrence.examYear,
              postName: occurrence.postName,
              department: occurrence.department,
              questionNumber: occurrence.questionNumber,
              source: occurrence.source,
              sourcePage: occurrence.sourcePage,
              sourceUrl: occurrence.sourceUrl,
            })),
          },
        },
        include: {
          options: {
            orderBy: { sortOrder: 'asc' },
          },
          occurrences: true,
        },
      });
    });

    return {
      success: true,
      message: 'Question created successfully.',
      data: question,
    };
  }

  // ==========================================
  // GET ALL QUESTIONS + ADVANCED FILTERS
  // ==========================================

  async findAll(query: {
    page?: string;
    limit?: string;
    search?: string;
    yearFrom?: string;
    yearTo?: string;
    institution?: string;
    exam?: string;
    post?: string;
    subject?: string;
    topic?: string;
    questionType?: string;
    difficulty?: string;
    status?: string;
    hasAnswer?: string;
    hasExplanation?: string;
    isRepeated?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

    const search = query.search?.trim();

    const yearFrom = query.yearFrom
      ? Number(query.yearFrom)
      : undefined;

    const yearTo = query.yearTo
      ? Number(query.yearTo)
      : undefined;

    if (
      yearFrom !== undefined &&
      (!Number.isInteger(yearFrom) || yearFrom < 1900 || yearFrom > 2100)
    ) {
      throw new BadRequestException('Invalid yearFrom value.');
    }

    if (
      yearTo !== undefined &&
      (!Number.isInteger(yearTo) || yearTo < 1900 || yearTo > 2100)
    ) {
      throw new BadRequestException('Invalid yearTo value.');
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

    const validQuestionTypes = [
      'MCQ',
      'TRUE_FALSE',
      'FILL_IN_THE_BLANKS',
      'WRITTEN',
    ];

    if (
      query.questionType &&
      !validQuestionTypes.includes(query.questionType)
    ) {
      throw new BadRequestException(
        'Invalid questionType. Allowed values: MCQ, TRUE_FALSE, FILL_IN_THE_BLANKS, WRITTEN.',
      );
    }

    const validDifficulties = ['EASY', 'MEDIUM', 'HARD'];

    if (
      query.difficulty &&
      !validDifficulties.includes(query.difficulty)
    ) {
      throw new BadRequestException(
        'Invalid difficulty. Allowed values: EASY, MEDIUM, HARD.',
      );
    }

    const validStatuses = ['DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED'];

    if (
      query.status &&
      !validStatuses.includes(query.status)
    ) {
      throw new BadRequestException(
        'Invalid status. Allowed values: DRAFT, PUBLISHED, HIDDEN, ARCHIVED.',
      );
    }

    const booleanFilters = [
      query.hasAnswer,
      query.hasExplanation,
      query.isRepeated,
    ];

    for (const value of booleanFilters) {
      if (
        value !== undefined &&
        value !== 'true' &&
        value !== 'false'
      ) {
        throw new BadRequestException(
          'Boolean filters only accept true or false.',
        );
      }
    }

    const andConditions: Prisma.QuestionWhereInput[] = [];

    if (search) {
      andConditions.push({
        OR: [
          {
            questionText: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            questionCode: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            subject: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            topic: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ],
      });
    }

    if (query.subject?.trim()) {
      andConditions.push({
        subject: {
          contains: query.subject.trim(),
          mode: 'insensitive',
        },
      });
    }

    if (query.topic?.trim()) {
      andConditions.push({
        topic: {
          contains: query.topic.trim(),
          mode: 'insensitive',
        },
      });
    }

    if (query.questionType) {
      andConditions.push({
        questionType: query.questionType as
          | 'MCQ'
          | 'TRUE_FALSE'
          | 'FILL_IN_THE_BLANKS'
          | 'WRITTEN',
      });
    }

    if (query.difficulty) {
      andConditions.push({
        difficulty: query.difficulty as
          | 'EASY'
          | 'MEDIUM'
          | 'HARD',
      });
    }

    if (query.status) {
      andConditions.push({
        status: query.status as
          | 'DRAFT'
          | 'PUBLISHED'
          | 'HIDDEN'
          | 'ARCHIVED',
      });
    }

    const occurrenceFilters: Prisma.QuestionOccurrenceWhereInput = {
      ...(yearFrom !== undefined || yearTo !== undefined
        ? {
            examYear: {
              ...(yearFrom !== undefined ? { gte: yearFrom } : {}),
              ...(yearTo !== undefined ? { lte: yearTo } : {}),
            },
          }
        : {}),

      ...(query.institution?.trim()
        ? {
            institution: {
              contains: query.institution.trim(),
              mode: 'insensitive',
            },
          }
        : {}),

      ...(query.exam?.trim()
        ? {
            examName: {
              contains: query.exam.trim(),
              mode: 'insensitive',
            },
          }
        : {}),

      ...(query.post?.trim()
        ? {
            postName: {
              contains: query.post.trim(),
              mode: 'insensitive',
            },
          }
        : {}),
    };

    if (Object.keys(occurrenceFilters).length > 0) {
      andConditions.push({
        occurrences: {
          some: occurrenceFilters,
        },
      });
    }

    if (query.hasAnswer === 'true') {
      andConditions.push({
        AND: [
          { correctAnswer: { not: null } },
          { NOT: { correctAnswer: '' } },
        ],
      });
    } else if (query.hasAnswer === 'false') {
      andConditions.push({
        OR: [
          { correctAnswer: null },
          { correctAnswer: '' },
        ],
      });
    }

    if (query.hasExplanation === 'true') {
      andConditions.push({
        AND: [
          { explanation: { not: null } },
          { NOT: { explanation: '' } },
        ],
      });
    } else if (query.hasExplanation === 'false') {
      andConditions.push({
        OR: [
          { explanation: null },
          { explanation: '' },
        ],
      });
    }

    if (query.isRepeated === 'true') {
      andConditions.push({
        repeatGroupId: { not: null },
      });
    } else if (query.isRepeated === 'false') {
      andConditions.push({
        repeatGroupId: null,
      });
    }

    const where: Prisma.QuestionWhereInput = {
      deletedAt: null,
      AND: andConditions,
    };

    const [questions, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          options: {
            orderBy: {
              sortOrder: 'asc',
            },
          },
          occurrences: true,
        },
      }),

      this.prisma.question.count({ where }),
    ]);

    return {
      success: true,
      data: questions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        search: search ?? null,
        yearFrom: yearFrom ?? null,
        yearTo: yearTo ?? null,
        institution: query.institution ?? null,
        exam: query.exam ?? null,
        post: query.post ?? null,
        subject: query.subject ?? null,
        topic: query.topic ?? null,
        questionType: query.questionType ?? null,
        difficulty: query.difficulty ?? null,
        status: query.status ?? null,
        hasAnswer: query.hasAnswer ?? null,
        hasExplanation: query.hasExplanation ?? null,
        isRepeated: query.isRepeated ?? null,
      },
    };
  }

  // ==========================================
  // GET SINGLE QUESTION BY ID
  // ==========================================

  async findOne(id: string) {
    const question = await this.prisma.question.findFirst({
      where: {
        id,
        deletedAt: null,
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
        histories: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!question) {
      throw new NotFoundException('Question not found.');
    }

    return {
      success: true,
      data: question,
    };
  }

  // ==========================================
  // UPDATE QUESTION + SAVE HISTORY
  // ==========================================

  async update(id: string, dto: UpdateQuestionDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.question.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        include: {
          options: {
            orderBy: { sortOrder: 'asc' },
          },
          occurrences: true,
        },
      });

      if (!existing) {
        throw new NotFoundException('Question not found.');
      }

      const nextQuestionType =
        dto.questionType ?? existing.questionType;

      const nextOptions =
        dto.options ?? existing.options;

      if (
        nextQuestionType === 'MCQ' &&
        nextOptions.length < 2
      ) {
        throw new BadRequestException(
          'MCQ questions must have at least two options.',
        );
      }

      if (nextQuestionType === 'MCQ') {
        const correctOptions = nextOptions.filter(
          (option) => option.isCorrect,
        );

        if (correctOptions.length !== 1) {
          throw new BadRequestException(
            'MCQ questions must have exactly one correct option.',
          );
        }
      }

      const latestHistory = await tx.questionHistory.findFirst({
        where: { questionId: id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      const version = (latestHistory?.version ?? 0) + 1;

      const snapshot = {
        ...existing,
        options: existing.options,
        occurrences: existing.occurrences,
      };

      await tx.questionHistory.create({
        data: {
          questionId: id,
          version,
          snapshot: snapshot as Prisma.InputJsonValue,
          changeNote: dto.changeNote,
        },
      });

      const updateData: Prisma.QuestionUpdateInput = {
        ...(dto.questionText !== undefined
          ? { questionText: dto.questionText }
          : {}),
        ...(dto.questionType !== undefined
          ? { questionType: dto.questionType }
          : {}),
        ...(dto.subject !== undefined
          ? { subject: dto.subject }
          : {}),
        ...(dto.topic !== undefined
          ? { topic: dto.topic }
          : {}),
        ...(dto.correctAnswer !== undefined
          ? { correctAnswer: dto.correctAnswer }
          : {}),
        ...(dto.explanation !== undefined
          ? { explanation: dto.explanation }
          : {}),
        ...(dto.difficulty !== undefined
          ? { difficulty: dto.difficulty }
          : {}),
        ...(dto.status !== undefined
          ? { status: dto.status }
          : {}),
      };

      await tx.question.update({
        where: { id },
        data: {
          ...updateData,

          ...(dto.options !== undefined
            ? {
                options: {
                  deleteMany: {},
                  create: dto.options.map((option) => ({
                    label: option.label,
                    optionText: option.optionText,
                    isCorrect: option.isCorrect ?? false,
                    sortOrder: option.sortOrder ?? 0,
                  })),
                },
              }
            : {}),

          ...(dto.addOccurrences?.length
            ? {
                occurrences: {
                  create: dto.addOccurrences.map((occurrence) => ({
                    institution: occurrence.institution,
                    examName: occurrence.examName,
                    examYear: occurrence.examYear,
                    postName: occurrence.postName,
                    department: occurrence.department,
                    questionNumber: occurrence.questionNumber,
                    source: occurrence.source,
                    sourcePage: occurrence.sourcePage,
                    sourceUrl: occurrence.sourceUrl,
                  })),
                },
              }
            : {}),
        },
      });

      const updated = await tx.question.findUnique({
        where: { id },
        include: {
          options: {
            orderBy: { sortOrder: 'asc' },
          },
          occurrences: {
            orderBy: { examYear: 'desc' },
          },
          histories: {
            orderBy: { version: 'desc' },
          },
        },
      });

      return {
        success: true,
        message: 'Question updated successfully.',
        version,
        data: updated,
      };
    });
  }

  // ==========================================
  // GET ALL QUESTION HISTORY VERSIONS
  // ==========================================

  async getHistory(id: string) {
    const question = await this.prisma.question.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        questionCode: true,
      },
    });

    if (!question) {
      throw new NotFoundException('Question not found.');
    }

    const histories = await this.prisma.questionHistory.findMany({
      where: { questionId: id },
      orderBy: { version: 'desc' },
    });

    return {
      success: true,
      question,
      totalVersions: histories.length,
      data: histories,
    };
  }

  // ==========================================
  // GET A SPECIFIC QUESTION HISTORY VERSION
  // ==========================================

  async getHistoryVersion(id: string, version: number) {
    if (!Number.isInteger(version) || version < 1) {
      throw new BadRequestException('Invalid history version.');
    }

    const question = await this.prisma.question.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        questionCode: true,
      },
    });

    if (!question) {
      throw new NotFoundException('Question not found.');
    }

    const history = await this.prisma.questionHistory.findUnique({
      where: {
        questionId_version: {
          questionId: id,
          version,
        },
      },
    });

    if (!history) {
      throw new NotFoundException(
        `History version ${version} not found.`,
      );
    }

    return {
      success: true,
      data: history,
    };
  }

  // ==========================================
  // RESTORE QUESTION FROM A HISTORY VERSION
  // ==========================================

  async restoreHistory(id: string, version: number) {
    if (!Number.isInteger(version) || version < 1) {
      throw new BadRequestException('Invalid history version.');
    }

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.question.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        include: {
          options: {
            orderBy: { sortOrder: 'asc' },
          },
          occurrences: true,
        },
      });

      if (!current) {
        throw new NotFoundException('Question not found.');
      }

      const targetHistory = await tx.questionHistory.findUnique({
        where: {
          questionId_version: {
            questionId: id,
            version,
          },
        },
      });

      if (!targetHistory) {
        throw new NotFoundException(
          `History version ${version} not found.`,
        );
      }

      type QuestionSnapshot = {
        questionText: string;
        questionType:
          | 'MCQ'
          | 'TRUE_FALSE'
          | 'FILL_IN_THE_BLANKS'
          | 'WRITTEN';
        subject: string;
        topic: string;
        correctAnswer: string | null;
        explanation: string | null;
        difficulty: 'EASY' | 'MEDIUM' | 'HARD';
        status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED';
        options: {
          label: string;
          optionText: string;
          isCorrect: boolean;
          sortOrder: number;
        }[];
        occurrences: {
          institution: string;
          examName: string;
          examYear: number;
          postName: string | null;
          department: string | null;
          questionNumber: number | null;
          source: string | null;
          sourcePage: number | null;
          sourceUrl: string | null;
          institutionId?: string | null;
          examId?: string | null;
          postId?: string | null;
          sourceDocumentId?: string | null;
        }[];
      };

      const snapshot =
        targetHistory.snapshot as unknown as QuestionSnapshot;

      if (
        !snapshot ||
        !Array.isArray(snapshot.options) ||
        !Array.isArray(snapshot.occurrences)
      ) {
        throw new BadRequestException(
          'The selected history snapshot is invalid.',
        );
      }

      const latestHistory = await tx.questionHistory.findFirst({
        where: { questionId: id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      const newVersion = (latestHistory?.version ?? 0) + 1;

      await tx.questionHistory.create({
        data: {
          questionId: id,
          version: newVersion,
          snapshot: current as unknown as Prisma.InputJsonValue,
          changeNote: `Saved current state before restoring version ${version}.`,
        },
      });

      const restored = await tx.question.update({
        where: { id },
        data: {
          questionText: snapshot.questionText,
          questionType: snapshot.questionType,
          subject: snapshot.subject,
          topic: snapshot.topic,
          correctAnswer: snapshot.correctAnswer,
          explanation: snapshot.explanation,
          difficulty: snapshot.difficulty,
          status: snapshot.status,

          options: {
            deleteMany: {},
            create: snapshot.options.map((option) => ({
              label: option.label,
              optionText: option.optionText,
              isCorrect: option.isCorrect,
              sortOrder: option.sortOrder,
            })),
          },

          occurrences: {
            deleteMany: {},
            create: snapshot.occurrences.map((occurrence) => ({
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
          },
        },
        include: {
          options: {
            orderBy: { sortOrder: 'asc' },
          },
          occurrences: {
            orderBy: { examYear: 'desc' },
          },
          histories: {
            orderBy: { version: 'desc' },
          },
        },
      });

      return {
        success: true,
        message: `Question restored from history version ${version}.`,
        restoredFromVersion: version,
        savedCurrentVersion: newVersion,
        data: restored,
      };
    });
  }

  // ==========================================
  // SOFT DELETE QUESTION
  // ==========================================

  async softDelete(id: string) {
    const question = await this.prisma.question.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!question) {
      return {
        success: false,
        message: 'Question not found or already deleted.',
      };
    }

    const deletedQuestion = await this.prisma.question.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Question moved to trash successfully.',
      data: deletedQuestion,
    };
  }

  // ==========================================
  // GET DELETED QUESTIONS (TRASH)
  // ==========================================

  async getDeletedQuestions(query: {
    page?: string;
    limit?: string;
    search?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const search = query.search?.trim();

    const where: Prisma.QuestionWhereInput = {
      deletedAt: {
        not: null,
      },

      ...(search
        ? {
            OR: [
              {
                questionText: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                questionCode: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                subject: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                topic: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [questions, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          deletedAt: 'desc',
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
      }),

      this.prisma.question.count({ where }),
    ]);

    return {
      success: true,
      data: questions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        search: search ?? null,
      },
    };
  }

  // ==========================================
  // RECOVER DELETED QUESTION
  // ==========================================

  async recover(id: string) {
    const question = await this.prisma.question.findFirst({
      where: {
        id,
        deletedAt: {
          not: null,
        },
      },
    });

    if (!question) {
      return {
        success: false,
        message: 'Deleted question not found.',
      };
    }

    const recoveredQuestion = await this.prisma.question.update({
      where: { id },
      data: {
        deletedAt: null,
      },
    });

    return {
      success: true,
      message: 'Question recovered successfully.',
      data: recoveredQuestion,
    };
  }
}
