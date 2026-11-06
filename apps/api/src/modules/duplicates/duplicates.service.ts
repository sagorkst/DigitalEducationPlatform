
import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

import { CreateDuplicateDto } from './dto/create-duplicate.dto';
import { ReviewDuplicateDto } from './dto/review-duplicate.dto';
import { MergeDuplicateDto } from './dto/merge-duplicate.dto';

@Injectable()
export class DuplicatesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly duplicateInclude = {
    questionA: {
      select: {
        id: true,
        questionCode: true,
        questionText: true,
        questionType: true,
        subject: true,
        topic: true,
        status: true,
        deletedAt: true,
      },
    },
    questionB: {
      select: {
        id: true,
        questionCode: true,
        questionText: true,
        questionType: true,
        subject: true,
        topic: true,
        status: true,
        deletedAt: true,
      },
    },
  };

  private normalizePair(questionAId: string, questionBId: string) {
    if (questionAId === questionBId) {
      throw new BadRequestException(
        'A question cannot be a duplicate of itself.',
      );
    }

    return questionAId < questionBId
      ? { questionAId, questionBId }
      : { questionAId: questionBId, questionBId: questionAId };
  }

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateSimilarity(textA: string, textB: string): number {
    const a = this.normalizeText(textA);
    const b = this.normalizeText(textB);

    if (!a || !b) return 0;
    if (a === b) return 1;

    const wordsA = new Set(a.split(' '));
    const wordsB = new Set(b.split(' '));

    const intersection = [...wordsA].filter((word) =>
      wordsB.has(word),
    ).length;

    const union = new Set([...wordsA, ...wordsB]).size;

    return union === 0 ? 0 : Number((intersection / union).toFixed(4));
  }

  private async ensureActiveQuestion(questionId: string) {
    const question = await this.prisma.question.findFirst({
      where: {
        id: questionId,
        deletedAt: null,
      },
      select: {
        id: true,
        questionText: true,
        questionType: true,
        repeatGroupId: true,
      },
    });

    if (!question) {
      throw new NotFoundException(
        `Active question ${questionId} was not found.`,
      );
    }

    return question;
  }

  // ==========================================
  // CREATE DUPLICATE CANDIDATE
  // ==========================================

  async create(dto: CreateDuplicateDto) {
    if (dto.questionAId === dto.questionBId) {
      throw new BadRequestException(
        'A question cannot be a duplicate of itself.',
      );
    }

    const [questionA, questionB] = await Promise.all([
      this.ensureActiveQuestion(dto.questionAId),
      this.ensureActiveQuestion(dto.questionBId),
    ]);

    const pair = this.normalizePair(
      dto.questionAId,
      dto.questionBId,
    );

    const existing = await this.prisma.duplicateCandidate.findFirst({
      where: {
        OR: [
          pair,
          {
            questionAId: pair.questionBId,
            questionBId: pair.questionAId,
          },
        ],
      },
    });

    if (existing) {
      throw new ConflictException(
        'A duplicate candidate already exists for these questions.',
      );
    }

    const similarity = dto.similarity;

    if (
      !Number.isFinite(similarity) ||
      similarity < 0 ||
      similarity > 1
    ) {
      throw new BadRequestException(
        'Similarity must be between 0 and 1.',
      );
    }

    const candidate = await this.prisma.duplicateCandidate.create({
      data: {
        ...pair,
        similarity,
        reviewNote: dto.reviewNote,
        status: 'PENDING',
      },
      include: this.duplicateInclude,
    });

    return {
      success: true,
      message: 'Duplicate candidate created successfully.',
      data: candidate,
    };
  }

  // ==========================================
  // AUTOMATIC DUPLICATE DETECTION
  // ==========================================

  async detect(threshold = 0.8, limit = 200) {
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
      throw new BadRequestException(
        'Threshold must be between 0 and 1.',
      );
    }

    if (!Number.isInteger(limit) || limit < 2 || limit > 500) {
      throw new BadRequestException(
        'Limit must be between 2 and 500.',
      );
    }

    const questions = await this.prisma.question.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        questionText: true,
        questionType: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    let scannedPairs = 0;
    let createdCandidates = 0;
    let skippedCandidates = 0;

    for (let i = 0; i < questions.length; i++) {
      for (let j = i + 1; j < questions.length; j++) {
        const questionA = questions[i];
        const questionB = questions[j];

        if (questionA.questionType !== questionB.questionType) {
          continue;
        }

        scannedPairs++;

        const similarity = this.calculateSimilarity(
          questionA.questionText,
          questionB.questionText,
        );

        if (similarity < threshold) {
          continue;
        }

        const pair = this.normalizePair(
          questionA.id,
          questionB.id,
        );

        const existing =
          await this.prisma.duplicateCandidate.findFirst({
            where: {
              OR: [
                pair,
                {
                  questionAId: pair.questionBId,
                  questionBId: pair.questionAId,
                },
              ],
            },
            select: {
              id: true,
            },
          });

        if (existing) {
          skippedCandidates++;
          continue;
        }

        try {
          await this.prisma.duplicateCandidate.create({
            data: {
              ...pair,
              similarity,
              status: 'PENDING',
            },
          });

          createdCandidates++;
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            skippedCandidates++;
            continue;
          }

          throw error;
        }
      }
    }

    return {
      success: true,
      message: 'Duplicate detection completed.',
      data: {
        questionsScanned: questions.length,
        scannedPairs,
        threshold,
        createdCandidates,
        skippedCandidates,
      },
    };
  }

  // ==========================================
  // GET ALL DUPLICATE CANDIDATES
  // ==========================================

  async findAll(query: {
    page?: string;
    limit?: string;
    status?: string;
    search?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(query.limit) || 20),
    );

    const allowedStatuses = [
      'PENDING',
      'CONFIRMED',
      'REJECTED',
      'MERGED',
    ];

    if (
      query.status &&
      !allowedStatuses.includes(query.status.toUpperCase())
    ) {
      throw new BadRequestException('Invalid duplicate status.');
    }

    const search = query.search?.trim();

    const where: Prisma.DuplicateCandidateWhereInput = {
      ...(query.status
        ? { status: query.status.toUpperCase() as any }
        : {}),
      ...(search
        ? {
            OR: [
              {
                questionA: {
                  questionText: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                questionB: {
                  questionText: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                questionA: {
                  questionCode: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                questionB: {
                  questionCode: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [candidates, total] = await this.prisma.$transaction([
      this.prisma.duplicateCandidate.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          { similarity: 'desc' },
          { createdAt: 'desc' },
        ],
        include: this.duplicateInclude,
      }),

      this.prisma.duplicateCandidate.count({ where }),
    ]);

    return {
      success: true,
      data: candidates,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        status: query.status ?? null,
        search: search ?? null,
      },
    };
  }

  // ==========================================
  // GET DUPLICATE CANDIDATE DETAILS
  // ==========================================

  async findOne(id: string) {
    const candidate = await this.prisma.duplicateCandidate.findUnique({
      where: { id },
      include: this.duplicateInclude,
    });

    if (!candidate) {
      throw new NotFoundException(
        'Duplicate candidate not found.',
      );
    }

    return {
      success: true,
      data: candidate,
    };
  }

  // ==========================================
  // CONFIRM OR REJECT DUPLICATE
  // ==========================================

  async review(id: string, dto: ReviewDuplicateDto) {
    const candidate = await this.prisma.duplicateCandidate.findUnique({
      where: { id },
    });

    if (!candidate) {
      throw new NotFoundException(
        'Duplicate candidate not found.',
      );
    }

    if (candidate.status === 'MERGED') {
      throw new ConflictException(
        'A merged duplicate candidate cannot be reviewed again.',
      );
    }

    const updated = await this.prisma.duplicateCandidate.update({
      where: { id },
      data: {
        status: dto.status,
        reviewNote: dto.reviewNote,
        reviewedBy: dto.reviewedBy,
        reviewedAt: new Date(),
      },
      include: this.duplicateInclude,
    });

    return {
      success: true,
      message: `Duplicate candidate ${dto.status.toLowerCase()} successfully.`,
      data: updated,
    };
  }

  // ==========================================
  // MERGE CONFIRMED DUPLICATE QUESTIONS
  // ==========================================

  async merge(id: string, dto: MergeDuplicateDto) {
    return this.prisma.$transaction(async (tx) => {
      const candidate = await tx.duplicateCandidate.findUnique({
        where: { id },
        include: {
          questionA: true,
          questionB: true,
        },
      });

      if (!candidate) {
        throw new NotFoundException(
          'Duplicate candidate not found.',
        );
      }

      if (candidate.status !== 'CONFIRMED') {
        throw new ConflictException(
          'Only confirmed duplicate candidates can be merged.',
        );
      }

      const primaryQuestionId = dto.primaryQuestionId;

      if (
        primaryQuestionId !== candidate.questionAId &&
        primaryQuestionId !== candidate.questionBId
      ) {
        throw new BadRequestException(
          'Primary question must belong to this duplicate candidate.',
        );
      }

      const secondaryQuestionId =
        primaryQuestionId === candidate.questionAId
          ? candidate.questionBId
          : candidate.questionAId;

      const primary = await tx.question.findFirst({
        where: {
          id: primaryQuestionId,
          deletedAt: null,
        },
      });

      const secondary = await tx.question.findFirst({
        where: {
          id: secondaryQuestionId,
          deletedAt: null,
        },
      });

      if (!primary || !secondary) {
        throw new ConflictException(
          'Both questions must be active before merging.',
        );
      }

      // Move all occurrences to the primary question.
      const movedOccurrences =
        await tx.questionOccurrence.updateMany({
          where: {
            questionId: secondaryQuestionId,
          },
          data: {
            questionId: primaryQuestionId,
          },
        });

      // Copy secondary tags to primary without duplicates.
      const secondaryTags = await tx.questionTagLink.findMany({
        where: {
          questionId: secondaryQuestionId,
        },
        select: {
          tagId: true,
        },
      });

      if (secondaryTags.length > 0) {
        await tx.questionTagLink.createMany({
          data: secondaryTags.map((tag) => ({
            questionId: primaryQuestionId,
            tagId: tag.tagId,
          })),
          skipDuplicates: true,
        });

        await tx.questionTagLink.deleteMany({
          where: {
            questionId: secondaryQuestionId,
          },
        });
      }

      // Preserve a shared repeat group for both records.
      const repeatGroupId =
        primary.repeatGroupId ??
        secondary.repeatGroupId ??
        randomUUID();

      await tx.question.update({
        where: {
          id: primaryQuestionId,
        },
        data: {
          repeatGroupId,
        },
      });

      // Soft-delete secondary. Its options and history remain untouched.
      await tx.question.update({
        where: {
          id: secondaryQuestionId,
        },
        data: {
          deletedAt: new Date(),
          repeatGroupId,
        },
      });

      const updatedCandidate =
        await tx.duplicateCandidate.update({
          where: { id },
          data: {
            status: 'MERGED',
            reviewNote: dto.reviewNote ?? candidate.reviewNote,
            reviewedBy: dto.reviewedBy ?? candidate.reviewedBy,
            reviewedAt: new Date(),
          },
          include: this.duplicateInclude,
        });

      return {
        success: true,
        message: 'Questions merged successfully.',
        data: {
          candidate: updatedCandidate,
          primaryQuestionId,
          secondaryQuestionId,
          movedOccurrences: movedOccurrences.count,
          copiedTags: secondaryTags.length,
          secondaryQuestionSoftDeleted: true,
          secondaryOptionsPreserved: true,
          secondaryHistoryPreserved: true,
        },
      };
    });
  }
}
