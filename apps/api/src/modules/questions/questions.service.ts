import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
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
  // HANDLE UNIQUE CONSTRAINT ERRORS
  // ==========================================

  private handleQuestionError(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    ) {
      throw new ConflictException(
        'à¦à¦‡ à¦ªà§à¦°à¦¶à§à¦¨à§‡à¦° à¦à¦•à¦‡ à¦ªà¦°à§€à¦•à§à¦·à¦¾à¦° à¦¤à¦¥à§à¦¯ à¦†à¦—à§‡ à¦¥à§‡à¦•à§‡à¦‡ à¦¯à§à¦•à§à¦¤ à¦†à¦›à§‡à¥¤',
      );
    }

    throw error;
  }

  // ==========================================
  // RESOLVE QUESTION OCCURRENCE
  // EXAM IS SOURCE OF TRUTH WHEN examId EXISTS
  // ==========================================

  private async resolveOccurrenceData(
    tx: Prisma.TransactionClient,
    occurrence: {
      institution: string;
      examName: string;
      examYear: number;
      postName?: string;
      department?: string;
      questionNumber?: number;
      source?: string;
      sourcePage?: number;
      sourceUrl?: string;
      institutionId?: string;
      examId?: string;
      postId?: string;
      sourceDocumentId?: string;
    },
  ) {
    if (!occurrence.examId) {
      // Legacy text-based occurrence remains supported.
      return {
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
        examId: undefined,
        postId: occurrence.postId,
        sourceDocumentId: occurrence.sourceDocumentId,
      };
    }

    // Exam is the source of truth for linked occurrences.
    const exam = await tx.exam.findUnique({
      where: {
        id: occurrence.examId,
      },
      select: {
        id: true,
        name: true,
        examYear: true,
        institutionId: true,
        postId: true,
      },
    });

    if (!exam) {
      throw new BadRequestException(
        'Selected Exam does not exist.',
      );
    }

    // Validate supplied Institution ID against the selected Exam.
    if (
      occurrence.institutionId &&
      occurrence.institutionId !== exam.institutionId
    ) {
      throw new BadRequestException(
        'The selected Institution does not match the selected Exam.',
      );
    }

    // Validate supplied Post ID against the selected Exam.
    if (
      occurrence.postId &&
      occurrence.postId !== exam.postId
    ) {
      throw new BadRequestException(
        'The selected Post does not match the selected Exam.',
      );
    }

    return {
      // Preserve the supplied text values, consistent with ImportsService.
      institution: occurrence.institution,
      examName: exam.name,
      examYear: exam.examYear,
      postName: occurrence.postName,
      department: occurrence.department,
      questionNumber: occurrence.questionNumber,
      source: occurrence.source,
      sourcePage: occurrence.sourcePage,
      sourceUrl: occurrence.sourceUrl,

      // These relations are derived from the selected Exam.
      institutionId: exam.institutionId,
      examId: exam.id,
      postId: exam.postId,

      sourceDocumentId: occurrence.sourceDocumentId,
    };
  }

  // ==========================================
  // CREATE QUESTION
  // ==========================================

  async create(dto: CreateQuestionDto) {
    const questionType = dto.questionType ?? 'MCQ';

    if (
      questionType === 'MCQ' &&
      (!dto.options || dto.options.length < 2 || dto.options.length > 4)
    ) {
      throw new BadRequestException(
        'MCQ questions must have 2 to 4 options.',
      );
    }

    if (dto.options?.some((option) =>
      !option.optionText.trim() &&
      !(Array.isArray(option.imageReferences) && option.imageReferences.length > 0)
    )) {
      throw new BadRequestException('Each option must contain text or at least one image.');
    }

    const questionCode = `Q-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;

    try {
      const question = await this.prisma.$transaction(async (tx) => {
        let selectedSubject: {
          id: string;
          name: string;
          isActive: boolean;
        } | null = null;

        let selectedTopic: {
          id: string;
          name: string;
          subjectId: string;
          isActive: boolean;
          subject: {
            id: string;
            name: string;
            isActive: boolean;
          };
        } | null = null;

        if (dto.subjectId) {
          selectedSubject = await tx.subject.findFirst({
            where: {
              id: dto.subjectId,
              isActive: true,
            },
            select: {
              id: true,
              name: true,
              isActive: true,
            },
          });

          if (!selectedSubject) {
            throw new BadRequestException(
              'Selected Subject does not exist or is inactive.',
            );
          }
        }

        if (dto.topicId) {
          selectedTopic = await tx.topic.findFirst({
            where: {
              id: dto.topicId,
              isActive: true,
            },
            include: {
              subject: {
                select: {
                  id: true,
                  name: true,
                  isActive: true,
                },
              },
            },
          });

          if (!selectedTopic || !selectedTopic.subject.isActive) {
            throw new BadRequestException(
              'Selected Topic does not exist or its Subject is inactive.',
            );
          }

          if (
            selectedSubject &&
            selectedTopic.subjectId !== selectedSubject.id
          ) {
            throw new BadRequestException(
              'Selected Topic must belong to the selected Subject.',
            );
          }

          if (!selectedSubject) {
            selectedSubject = selectedTopic.subject;
          }
        }

        // Resolve every occurrence inside the same transaction.
        const occurrenceData = await Promise.all(
          dto.occurrences.map((occurrence) =>
            this.resolveOccurrenceData(tx, occurrence),
          ),
        );

        return tx.question.create({
          data: {
            questionCode,
            questionText: dto.questionText,
            ...(dto.imageReferences?.length ? { imageReferences: dto.imageReferences as Prisma.InputJsonValue } : {}),
            questionType,

            subject: selectedSubject?.name ?? dto.subject,
            topic: selectedTopic?.name ?? dto.topic,

            ...(selectedSubject
              ? {
                  subjectRef: {
                    connect: { id: selectedSubject.id },
                  },
                }
              : {}),

            ...(selectedTopic
              ? {
                  topicRef: {
                    connect: { id: selectedTopic.id },
                  },
                }
              : {}),

            correctAnswer: dto.correctAnswer,
            explanation: dto.explanation,
            difficulty: dto.difficulty ?? 'MEDIUM',
            status: dto.status ?? 'DRAFT',

            options: {
              create: (dto.options ?? []).map((option) => ({
                label: option.label,
                optionText: option.optionText,
                ...(option.imageReferences?.length ? { imageReferences: option.imageReferences as Prisma.InputJsonValue } : {}),
                isCorrect: option.isCorrect ?? false,
                sortOrder: option.sortOrder ?? 0,
              })),
            },

            occurrences: {
              create: occurrenceData,
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
    } catch (error) {
      this.handleQuestionError(error);
    }
  }

  // ==========================================
  // GET INSTITUTION / EXAM GROUP OPTIONS
  // Returns occurrence metadata only, not question contents.
  // Supports both canonical IDs and legacy text occurrences.
  // ==========================================

  async getGroupOptions() {
    const occurrences = await this.prisma.questionOccurrence.findMany({
      where: {
        question: {
          is: {
            deletedAt: null,
          },
        },
      },
      select: {
        institutionId: true,
        institution: true,
        examId: true,
        examName: true,
        examYear: true,
        postName: true,
        department: true,
        institutionRef: {
          select: {
            id: true,
            name: true,
          },
        },
        examRef: {
          select: {
            id: true,
            name: true,
            examYear: true,
            institutionId: true,
            institution: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { institution: 'asc' },
        { examName: 'asc' },
        { examYear: 'desc' },
      ],
    });

    const institutions = new Map<string, any>();
    const exams = new Map<string, any>();

    for (const occurrence of occurrences) {
      const institutionId =
        occurrence.examRef?.institutionId ??
        occurrence.institutionId ??
        null;

      const institutionName =
        occurrence.examRef?.institution?.name ??
        occurrence.institutionRef?.name ??
        occurrence.institution ??
        'Unknown Institution';

      const institutionKey = institutionId
        ? `institution:${institutionId}`
        : `institution-name:${institutionName.trim().toLowerCase()}`;

      if (!institutions.has(institutionKey)) {
        institutions.set(institutionKey, {
          id: institutionId,
          groupKey: institutionKey,
          name: institutionName,
          exams: [],
        });
      }

      const examName =
        occurrence.examRef?.name ?? occurrence.examName;

      const examYear =
        occurrence.examRef?.examYear ?? occurrence.examYear;

      // Canonical Exam ID is preferred.
      // Legacy groups use the complete identifying combination.
      const examKey = occurrence.examId
        ? `exam:${occurrence.examId}`
        : `legacy:${JSON.stringify([
            institutionName.trim().toLowerCase(),
            (examName ?? '').trim().toLowerCase(),
            examYear,
            occurrence.postName ?? null,
            occurrence.department ?? null,
          ])}`;

      if (!exams.has(examKey)) {
        const examGroup = {
          id: occurrence.examId ?? null,
          groupKey: examKey,
          institutionId,
          institutionName,
          examName,
          examYear,
          postName: occurrence.postName,
          department: occurrence.department,
        };

        exams.set(examKey, examGroup);
        institutions.get(institutionKey).exams.push(examGroup);
      }
    }

    const [
      totalQuestions,
      canonicalInstitutionCount,
      canonicalExamCount,
      canonicalSubjectCount,
      legacySubjectRows,
    ] = await Promise.all([
      this.prisma.question.count({ where: { deletedAt: null } }),
      this.prisma.institution.count(),
      this.prisma.exam.count(),
      this.prisma.subject.count(),
      this.prisma.question.findMany({
        where: { deletedAt: null },
        select: { subject: true },
        distinct: ['subject'],
      }),
    ]);

    // Include legacy text-based records as well as canonical entities.
    // This keeps dashboard totals accurate while older questions are being
    // migrated to Institution / Exam / Subject relations.
    const legacySubjectCount = new Set(
      legacySubjectRows
        .map((row) => row.subject?.trim())
        .filter((name): name is string => Boolean(name)),
    ).size;

    const totalInstitutions = Math.max(
      canonicalInstitutionCount,
      institutions.size,
    );
    const totalExams = Math.max(canonicalExamCount, exams.size);
    const totalSubjects = Math.max(canonicalSubjectCount, legacySubjectCount);

    return {
      success: true,
      stats: {
        totalQuestions,
        totalInstitutions,
        totalExams,
        totalSubjects,
      },
      data: {
        institutions: Array.from(institutions.values()).map(
          (institution) => ({
            ...institution,
            exams: institution.exams.sort(
              (a: any, b: any) =>
                b.examYear - a.examYear ||
                a.examName.localeCompare(b.examName),
            ),
          }),
        ),
        exams: Array.from(exams.values()).sort(
          (a, b) =>
            a.institutionName.localeCompare(b.institutionName) ||
            b.examYear - a.examYear ||
            a.examName.localeCompare(b.examName),
        ),
      },
    };
  }

  // ==========================================
  // GET ALL QUESTIONS FOR ONE EXACT EXAM GROUP
  // No arbitrary 100-question pagination limit.
  // One Question record is returned once even if it has
  // multiple matching occurrences.
  // ==========================================

  async findByGroup(query: {
    examId?: string;
    institution?: string;
    examName?: string;
    examYear?: string;
    postName?: string;
    department?: string;
  }) {
    let occurrenceWhere: Prisma.QuestionOccurrenceWhereInput;

    if (query.examId?.trim()) {
      occurrenceWhere = {
        examId: query.examId.trim(),
      };
    } else {
      const institution = query.institution?.trim();
      const examName = query.examName?.trim();
      const examYear = Number(query.examYear);

      if (
        !institution ||
        !examName ||
        !query.examYear ||
        !Number.isInteger(examYear) ||
        examYear < 1900 ||
        examYear > 2100
      ) {
        throw new BadRequestException(
          'A valid Exam ID or complete legacy Exam group is required.',
        );
      }

      occurrenceWhere = {
        institution,
        examName,
        examYear,
        postName: query.postName?.trim() || null,
        department: query.department?.trim() || null,
        examId: null,
      };
    }

    const questions = await this.prisma.question.findMany({
      where: {
        deletedAt: null,
        occurrences: {
          some: occurrenceWhere,
        },
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

    return {
      success: true,
      data: questions,
      pagination: {
        total: questions.length,
        page: 1,
        limit: questions.length,
        totalPages: questions.length > 0 ? 1 : 0,
      },
      group: {
        examId: query.examId ?? null,
        institution: query.institution ?? null,
        examName: query.examName ?? null,
        examYear: query.examYear ? Number(query.examYear) : null,
        postName: query.postName ?? null,
        department: query.department ?? null,
      },
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
      OR: [
        {
          institution: {
            contains: query.institution.trim(),
            mode: 'insensitive',
          },
        },
        {
          institutionRef: {
            is: {
              name: {
                contains: query.institution.trim(),
                mode: 'insensitive',
              },
            },
          },
        },
        {
          examRef: {
            is: {
              institution: {
                is: {
                  name: {
                    contains: query.institution.trim(),
                    mode: 'insensitive',
                  },
                },
              },
            },
          },
        },
      ],
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
    try {
      return await this.prisma.$transaction(async (tx) => {
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

        const nextOptions = dto.options;

        if (
          nextQuestionType === 'MCQ' &&
          (nextOptions.length < 2 || nextOptions.length > 4)
        ) {
          throw new BadRequestException(
            'MCQ questions must have 2 to 4 options.',
          );
        }

        if (nextOptions?.some((option) =>
          !option.optionText.trim() &&
          !(Array.isArray(option.imageReferences) && option.imageReferences.length > 0)
        )) {
          throw new BadRequestException('Each option must contain text or at least one image.');
        }

        // Resolve Master Subject/Topic relations only when UUIDs are supplied.
        let relationSubject:
          | { id: string; name: string; isActive: boolean }
          | null = null;

        let relationTopic:
          | {
              id: string;
              name: string;
              subjectId: string;
              isActive: boolean;
              subject: { id: string; name: string; isActive: boolean };
            }
          | null = null;

        const relationIdsProvided =
          dto.subjectId !== undefined || dto.topicId !== undefined;

        if (relationIdsProvided) {
          if (dto.subjectId) {
            relationSubject = await tx.subject.findFirst({
              where: {
                id: dto.subjectId,
                isActive: true,
              },
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            });

            if (!relationSubject) {
              throw new BadRequestException(
                'Selected Subject does not exist or is inactive.',
              );
            }
          }

          if (dto.topicId) {
            relationTopic = await tx.topic.findFirst({
              where: {
                id: dto.topicId,
                isActive: true,
              },
              include: {
                subject: {
                  select: {
                    id: true,
                    name: true,
                    isActive: true,
                  },
                },
              },
            });

            if (!relationTopic || !relationTopic.subject.isActive) {
              throw new BadRequestException(
                'Selected Topic does not exist or its Subject is inactive.',
              );
            }

            if (
              relationSubject &&
              relationTopic.subjectId !== relationSubject.id
            ) {
              throw new BadRequestException(
                'Selected Topic must belong to the selected Subject.',
              );
            }

            if (!relationSubject) {
              relationSubject = relationTopic.subject;
            }
          } else if (dto.subjectId && existing.topicId) {
            const existingTopic = await tx.topic.findUnique({
              where: { id: existing.topicId },
              select: {
                id: true,
                subjectId: true,
              },
            });

            if (
              existingTopic &&
              existingTopic.subjectId !== relationSubject?.id
            ) {
              throw new BadRequestException(
                'The existing Topic belongs to another Subject. Provide a Topic ID belonging to the new Subject.',
              );
            }
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

          ...(dto.imageReferences !== undefined
            ? { imageReferences: dto.imageReferences as Prisma.InputJsonValue }
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

          ...(relationIdsProvided && relationSubject
            ? {
                subject: relationSubject.name,
                subjectRef: {
                  connect: { id: relationSubject.id },
                },
              }
            : {}),

          ...(relationIdsProvided && relationTopic
            ? {
                topic: relationTopic.name,
                topicRef: {
                  connect: { id: relationTopic.id },
                },
              }
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

        // Resolve new occurrences before updating.
        const occurrenceData = dto.addOccurrences?.length
          ? await Promise.all(
              dto.addOccurrences.map((occurrence) =>
                this.resolveOccurrenceData(tx, occurrence),
              ),
            )
          : [];

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
                      ...(option.imageReferences?.length ? { imageReferences: option.imageReferences as Prisma.InputJsonValue } : {}),
                      isCorrect: option.isCorrect ?? false,
                      sortOrder: option.sortOrder ?? 0,
                    })),
                  },
                }
              : {}),

            ...(occurrenceData.length
              ? {
                  occurrences: {
                    create: occurrenceData,
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
    } catch (error) {
      this.handleQuestionError(error);
    }
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

    try {
      return await this.prisma.$transaction(async (tx) => {
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
          imageReferences?: unknown;
          questionType:
            | 'MCQ'
            | 'TRUE_FALSE'
            | 'FILL_IN_THE_BLANKS'
            | 'WRITTEN';
          subject: string;
          topic: string;
          subjectId?: string | null;
          topicId?: string | null;
          correctAnswer: string | null;
          explanation: string | null;
          difficulty: 'EASY' | 'MEDIUM' | 'HARD';
          status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED';
          options: {
            label: string;
            optionText: string;
            imageReferences?: unknown;
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
            ...(Array.isArray(snapshot.imageReferences) ? { imageReferences: snapshot.imageReferences as Prisma.InputJsonValue } : {}),
            questionType: snapshot.questionType,
            subject: snapshot.subject,
            topic: snapshot.topic,

            ...(snapshot.subjectId !== undefined
              ? {
                  subjectRef: snapshot.subjectId
                    ? { connect: { id: snapshot.subjectId } }
                    : { disconnect: true },
                }
              : {}),

            ...(snapshot.topicId !== undefined
              ? {
                  topicRef: snapshot.topicId
                    ? { connect: { id: snapshot.topicId } }
                    : { disconnect: true },
                }
              : {}),

            correctAnswer: snapshot.correctAnswer,
            explanation: snapshot.explanation,
            difficulty: snapshot.difficulty,
            status: snapshot.status,

            options: {
              deleteMany: {},
              create: snapshot.options.map((option) => ({
                label: option.label,
                optionText: option.optionText,
                ...(Array.isArray(option.imageReferences) ? { imageReferences: option.imageReferences as Prisma.InputJsonValue } : {}),
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
    } catch (error) {
      this.handleQuestionError(error);
    }
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

  // ==========================================
  // PERMANENTLY DELETE QUESTION
  // ONLY QUESTIONS IN TRASH CAN BE DELETED
  // ==========================================

  async permanentDelete(id: string) {
    return this.prisma.$transaction(async (tx) => {
      // Step 1: Find question only if it is already in Trash.
      const question = await tx.question.findFirst({
        where: {
          id,
          deletedAt: {
            not: null,
          },
        },
        select: {
          id: true,
          questionCode: true,
          questionText: true,
          deletedAt: true,
        },
      });

      if (!question) {
        const existingQuestion = await tx.question.findUnique({
          where: { id },
          select: {
            id: true,
            deletedAt: true,
          },
        });

        if (!existingQuestion) {
          throw new NotFoundException('Question not found.');
        }

        if (existingQuestion.deletedAt === null) {
          throw new BadRequestException(
            'Active questions cannot be permanently deleted. Move the question to Trash first.',
          );
        }

        throw new NotFoundException('Deleted question not found.');
      }

      // Step 2: Detach ImportRow references.
      // ImportRow.questionId has no foreign key relation.
      const detachedImportRows = await tx.importRow.updateMany({
        where: {
          questionId: id,
        },
        data: {
          questionId: null,
        },
      });

      // Step 3: Delete only if the question is still in Trash.
      // Related records are deleted through database Cascade rules.
      const deletion = await tx.question.deleteMany({
        where: {
          id,
          deletedAt: {
            not: null,
          },
        },
      });

      if (deletion.count !== 1) {
        throw new BadRequestException(
          'Permanent deletion failed. The question may have been recovered or changed. Please try again.',
        );
      }

      return {
        success: true,
        message: 'Question permanently deleted successfully.',
        data: {
          id: question.id,
          questionCode: question.questionCode,
          questionText: question.questionText,
          permanentlyDeleted: true,
          detachedImportRows: detachedImportRows.count,
        },
      };
    });
  }

  // PERMANENTLY DELETE ALL QUESTIONS IN TRASH ONLY
  async emptyTrash() {
    return this.prisma.$transaction(async (tx) => {
      const trashedQuestions = await tx.question.findMany({
        where: {
          deletedAt: {
            not: null,
          },
        },
        select: {
          id: true,
        },
      });

      const ids = trashedQuestions.map((question) => question.id);

      if (ids.length === 0) {
        return {
          success: true,
          message: 'Trash is already empty.',
          data: {
            deletedCount: 0,
            detachedImportRows: 0,
          },
        };
      }

      const detachedImportRows = await tx.importRow.updateMany({
        where: {
          questionId: {
            in: ids,
          },
        },
        data: {
          questionId: null,
        },
      });

      const deletion = await tx.question.deleteMany({
        where: {
          id: {
            in: ids,
          },
          deletedAt: {
            not: null,
          },
        },
      });

      return {
        success: true,
        message: 'All trashed questions permanently deleted.',
        data: {
          deletedCount: deletion.count,
          detachedImportRows: detachedImportRows.count,
        },
      };
    });
  }}
