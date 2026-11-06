import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SubmitReviewDto } from './dto/submit-review.dto';

const REVIEW_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
] as const;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(questionId: string, dto: SubmitReviewDto) {
    return this.prisma.$transaction(async (tx) => {
      const question = await tx.question.findFirst({
        where: {
          id: questionId,
          deletedAt: null,
        },
        select: {
          id: true,
          questionCode: true,
          status: true,
        },
      });

      if (!question) {
        throw new NotFoundException('Question not found.');
      }

      if (question.status === 'ARCHIVED') {
        throw new BadRequestException(
          'Archived questions cannot be submitted for review.',
        );
      }

      const pendingReview = await tx.questionReview.findFirst({
        where: {
          questionId,
          status: 'PENDING',
        },
      });

      if (pendingReview) {
        throw new ConflictException(
          'This question already has a pending review.',
        );
      }

      const review = await tx.questionReview.create({
        data: {
          questionId,
          submissionNote: dto.submissionNote?.trim() || null,
        },
        include: {
          question: {
            select: {
              id: true,
              questionCode: true,
              questionText: true,
              status: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Question submitted for review successfully.',
        data: review,
      };
    });
  }

  async findAll(query: {
    page?: string;
    limit?: string;
    status?: string;
    questionId?: string;
    search?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

    if (
      query.status &&
      !REVIEW_STATUSES.includes(
        query.status as (typeof REVIEW_STATUSES)[number],
      )
    ) {
      throw new BadRequestException('Invalid review status.');
    }

    const where: Prisma.QuestionReviewWhereInput = {
      ...(query.status
        ? {
            status: query.status as (typeof REVIEW_STATUSES)[number],
          }
        : {}),
      ...(query.questionId
        ? { questionId: query.questionId }
        : {}),
      ...(query.search?.trim()
        ? {
            question: {
              OR: [
                {
                  questionText: {
                    contains: query.search.trim(),
                    mode: 'insensitive',
                  },
                },
                {
                  questionCode: {
                    contains: query.search.trim(),
                    mode: 'insensitive',
                  },
                },
              ],
            },
          }
        : {}),
    };

    const [reviews, total] = await this.prisma.$transaction([
      this.prisma.questionReview.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          submittedAt: 'desc',
        },
        include: {
          question: {
            select: {
              id: true,
              questionCode: true,
              questionText: true,
              subject: true,
              topic: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.questionReview.count({ where }),
    ]);

    return {
      success: true,
      data: reviews,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        status: query.status ?? null,
        questionId: query.questionId ?? null,
        search: query.search?.trim() || null,
      },
    };
  }

  async findOne(id: string) {
    const review = await this.prisma.questionReview.findUnique({
      where: { id },
      include: {
        question: {
          include: {
            options: {
              orderBy: { sortOrder: 'asc' },
            },
            occurrences: {
              orderBy: { examYear: 'desc' },
            },
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found.');
    }

    return {
      success: true,
      data: review,
    };
  }

  async getQuestionHistory(questionId: string) {
    const question = await this.prisma.question.findFirst({
      where: {
        id: questionId,
        deletedAt: null,
      },
      select: {
        id: true,
        questionCode: true,
        questionText: true,
      },
    });

    if (!question) {
      throw new NotFoundException('Question not found.');
    }

    const reviews = await this.prisma.questionReview.findMany({
      where: { questionId },
      orderBy: { submittedAt: 'desc' },
    });

    return {
      success: true,
      question,
      totalReviews: reviews.length,
      data: reviews,
    };
  }

  async approve(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.questionReview.findUnique({
        where: { id },
        select: {
          id: true,
          questionId: true,
          status: true,
        },
      });

      if (!review) {
        throw new NotFoundException('Review not found.');
      }

      if (review.status !== 'PENDING') {
        throw new ConflictException(
          'Only pending reviews can be approved.',
        );
      }

      const question = await tx.question.findFirst({
        where: {
          id: review.questionId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!question) {
        throw new NotFoundException(
          'The question is missing or deleted.',
        );
      }

      const result = await tx.questionReview.updateMany({
        where: {
          id,
          status: 'PENDING',
        },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
        },
      });

      if (result.count !== 1) {
        throw new ConflictException(
          'Review status changed. Please refresh and try again.',
        );
      }

      await tx.question.update({
        where: { id: review.questionId },
        data: { status: 'PUBLISHED' },
      });

      const updatedReview = await tx.questionReview.findUnique({
        where: { id },
        include: {
          question: {
            select: {
              id: true,
              questionCode: true,
              questionText: true,
              status: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Question review approved successfully.',
        data: updatedReview,
      };
    });
  }

  async reject(id: string, reviewNote: string) {
    if (!reviewNote || reviewNote.trim().length < 3) {
      throw new BadRequestException(
        'A rejection reason of at least 3 characters is required.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const review = await tx.questionReview.findUnique({
        where: { id },
        select: {
          id: true,
          questionId: true,
          status: true,
        },
      });

      if (!review) {
        throw new NotFoundException('Review not found.');
      }

      if (review.status !== 'PENDING') {
        throw new ConflictException(
          'Only pending reviews can be rejected.',
        );
      }

      const question = await tx.question.findFirst({
        where: {
          id: review.questionId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!question) {
        throw new NotFoundException(
          'The question is missing or deleted.',
        );
      }

      const result = await tx.questionReview.updateMany({
        where: {
          id,
          status: 'PENDING',
        },
        data: {
          status: 'REJECTED',
          reviewNote: reviewNote.trim(),
          reviewedAt: new Date(),
        },
      });

      if (result.count !== 1) {
        throw new ConflictException(
          'Review status changed. Please refresh and try again.',
        );
      }

      await tx.question.update({
        where: { id: review.questionId },
        data: { status: 'DRAFT' },
      });

      const updatedReview = await tx.questionReview.findUnique({
        where: { id },
        include: {
          question: {
            select: {
              id: true,
              questionCode: true,
              questionText: true,
              status: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Question review rejected.',
        data: updatedReview,
      };
    });
  }

  async cancel(id: string) {
    const result = await this.prisma.questionReview.updateMany({
      where: {
        id,
        status: 'PENDING',
      },
      data: {
        status: 'CANCELLED',
      },
    });

    if (result.count !== 1) {
      const existing = await this.prisma.questionReview.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existing) {
        throw new NotFoundException('Review not found.');
      }

      throw new ConflictException(
        'Only pending reviews can be cancelled.',
      );
    }

    return {
      success: true,
      message: 'Pending review cancelled successfully.',
      data: await this.prisma.questionReview.findUnique({
        where: { id },
      }),
    };
  }
}
