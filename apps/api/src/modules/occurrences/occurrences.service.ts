import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { CreateOccurrenceDto } from './dto/create-occurrence.dto';
import { UpdateOccurrenceDto } from './dto/update-occurrence.dto';
import { OccurrenceIdentityService } from './occurrence-identity.service';

@Injectable()
export class OccurrencesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly occurrenceInclude = {
    question: {
      select: {
        id: true,
        questionCode: true,
        questionText: true,
        status: true,
      },
    },
    institutionRef: true,
    examRef: true,
    postRef: true,
    sourceDocument: true,
  };

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }

  private handleOccurrenceError(error: unknown): never {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        'এই প্রশ্নের একই পরীক্ষার তথ্য আগে থেকেই যুক্ত আছে।',
      );
    }

    throw error;
  }

  private async resolveReferences(
    data: {
      institution?: string | null;
      examName?: string | null;
      examYear?: number | null;
      postName?: string | null;
      source?: string | null;
      institutionId?: string | null;
      examId?: string | null;
      postId?: string | null;
      sourceDocumentId?: string | null;
    },
    db: any = this.prisma,
  ) {
    let institution = data.institution;
    let examName = data.examName;
    let examYear = data.examYear;
    let postName = data.postName;
    let source = data.source;

    let institutionId = data.institutionId;
    let examId = data.examId;
    let postId = data.postId;
    let sourceDocumentId = data.sourceDocumentId;

    let exam: any = null;

    // ==========================================
    // RESOLVE EXAM
    // ==========================================

    if (examId) {
      exam = await db.exam.findUnique({
        where: { id: examId },
      });

      if (!exam) {
        throw new BadRequestException(
          'নির্বাচিত Exam পাওয়া যায়নি।',
        );
      }

      // Institution must match the selected Exam.
      if (
        institutionId &&
        institutionId !== exam.institutionId
      ) {
        throw new BadRequestException(
          'নির্বাচিত Exam-এর Institution-এর সঙ্গে প্রদত্ত Institution মিলছে না।',
        );
      }

      // Post must match the selected Exam.
      if (postId && postId !== exam.postId) {
        throw new BadRequestException(
          'নির্বাচিত Exam-এর Post-এর সঙ্গে প্রদত্ত Post মিলছে না।',
        );
      }

      // Exam Year must match the selected Exam.
      if (
        examYear !== undefined &&
        examYear !== exam.examYear
      ) {
        throw new BadRequestException(
          'প্রদত্ত Exam Year নির্বাচিত Exam-এর Year-এর সঙ্গে মিলছে না।',
        );
      }

      // Use the Exam's original information.
      institutionId = exam.institutionId;
      postId = exam.postId;
      examName = exam.name;
      examYear = exam.examYear;
    }

    // ==========================================
    // RESOLVE INSTITUTION
    // ==========================================

    if (institutionId) {
      const institutionRecord =
        await db.institution.findUnique({
          where: { id: institutionId },
        });

      if (!institutionRecord) {
        throw new BadRequestException(
          'নির্বাচিত Institution পাওয়া যায়নি।',
        );
      }

      if (!institutionRecord.isActive) {
        throw new BadRequestException(
          'নিষ্ক্রিয় Institution-এ প্রশ্ন যুক্ত করা যাবে না।',
        );
      }

      institution = institutionRecord.name;
    }

    // ==========================================
    // RESOLVE POST
    // ==========================================

    if (postId) {
      const post = await db.post.findUnique({
        where: { id: postId },
      });

      if (!post) {
        throw new BadRequestException(
          'নির্বাচিত Post পাওয়া যায়নি।',
        );
      }

      postName = post.name;
    }

    // ==========================================
    // RESOLVE SOURCE DOCUMENT
    // ==========================================

    if (sourceDocumentId) {
      const document = await db.sourceDocument.findUnique({
        where: { id: sourceDocumentId },
      });

      if (!document) {
        throw new BadRequestException(
          'নির্বাচিত Source Document পাওয়া যায়নি।',
        );
      }

      source = document.title;
    }

    // ==========================================
    // REQUIRED FIELD VALIDATION
    // ==========================================

    if (institution !== undefined && institution !== null && !institution.trim()) {
      institution = null;
    }

    if (examName !== undefined && examName !== null && !examName.trim()) {
      examName = null;
    }

    if (examYear !== undefined && examYear !== null && (
      !Number.isInteger(examYear) || examYear < 1900 || examYear > 2100
    )) {
      throw new BadRequestException('সঠিক Exam Year প্রদান করতে হবে।');
    }

    return {
      institution,
      examName,
      examYear,
      postName: postName ?? null,
      source: source ?? null,
      institutionId: institutionId ?? null,
      examId: examId ?? null,
      postId: postId ?? null,
      sourceDocumentId: sourceDocumentId ?? null,
    };
  }

  // ==========================================
  // ENSURE QUESTION EXISTS
  // ==========================================

  private async ensureQuestionExists(
    questionId: string,
    db: any = this.prisma,
  ) {
    const question = await db.question.findFirst({
      where: {
        id: questionId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!question) {
      throw new NotFoundException(
        'Question not found or has been deleted.',
      );
    }

    return question;
  }

  // ==========================================
  // DUPLICATE PROTECTION
  // ==========================================

  private async ensureNoDuplicate(
    data: {
      questionId: string;
      examName?: string | null;
      institution?: string | null;
      examYear?: number | null;
      postName?: string | null;
      institutionId?: string | null;
      examId?: string | null;
      postId?: string | null;
    },
    excludeId?: string,
    db: any = this.prisma,
  ) {
    const match = await OccurrenceIdentityService.findMatch(db, data.questionId, data, excludeId);
    if (match.kind !== 'CREATE') {
      throw new ConflictException(
        match.kind === 'AMBIGUOUS'
          ? 'এই প্রশ্নের একাধিক সম্ভাব্য Exam Occurrence পাওয়া গেছে। আগে তথ্যগুলো যাচাই করুন।'
          : 'এই প্রশ্নের একই পরীক্ষার তথ্য আগে থেকেই যুক্ত আছে।',
      );
    }
  }

  // ==========================================
  // CREATE QUESTION OCCURRENCE
  // ==========================================

  async create(questionId: string, dto: CreateOccurrenceDto) {
    try {
      const occurrence = await this.prisma.$transaction(
        async (tx) => {
          await this.ensureQuestionExists(questionId, tx);

          const references = await this.resolveReferences(
            {
              ...dto,
              examYear: dto.examYear,
            },
            tx,
          );

          const match = await OccurrenceIdentityService.findMatch(
            tx,
            questionId,
            references,
          );
          if (match.kind === 'AMBIGUOUS' || match.kind === 'MATCH') {
            throw new ConflictException(
              match.kind === 'AMBIGUOUS'
                ? 'এই প্রশ্নের একাধিক সম্ভাব্য Exam Occurrence পাওয়া গেছে। আগে তথ্যগুলো যাচাই করুন।'
                : 'এই প্রশ্নের একই পরীক্ষার তথ্য আগে থেকেই যুক্ত আছে।',
            );
          }

          if (match.kind === 'ENRICH') {
            const existing = match.occurrence;
            const patch: Record<string, unknown> = {};
            for (const field of [
              'institution', 'examName', 'examYear', 'postName', 'institutionId',
              'examId', 'postId', 'source', 'sourceDocumentId',
            ]) {
              const referenceValue = (references as Record<string, unknown>)[field];
              if ((existing[field] === null || existing[field] === undefined || existing[field] === '') &&
                  referenceValue !== null && referenceValue !== undefined && referenceValue !== '') {
                patch[field] = referenceValue;
              }
            }
            if (existing.department == null && dto.department !== undefined) patch.department = dto.department;
            if (existing.questionNumber == null && dto.questionNumber !== undefined) patch.questionNumber = dto.questionNumber;
            if (existing.sourcePage == null && dto.sourcePage !== undefined) patch.sourcePage = dto.sourcePage;
            if (existing.sourceUrl == null && dto.sourceUrl !== undefined) patch.sourceUrl = dto.sourceUrl;
            return tx.questionOccurrence.update({
              where: { id: existing.id },
              data: patch as any,
              include: this.occurrenceInclude,
            });
          }

          return tx.questionOccurrence.create({
            data: {
              questionId,
              institution: references.institution,
              examName: references.examName,
              examYear: references.examYear,
              postName: references.postName,
              department: dto.department,
              questionNumber: dto.questionNumber,
              source: references.source,
              sourcePage: dto.sourcePage,
              sourceUrl: dto.sourceUrl,
              institutionId: references.institutionId,
              examId: references.examId,
              postId: references.postId,
              sourceDocumentId: references.sourceDocumentId,
            },
            include: this.occurrenceInclude,
          });
        },
      );

      return {
        success: true,
        message: 'Question occurrence created successfully.',
        data: occurrence,
      };
    } catch (error) {
      this.handleOccurrenceError(error);
    }
  }

  // ==========================================
  // GET OCCURRENCES BY QUESTION
  // ==========================================

  async findAllByQuestion(questionId: string) {
    await this.ensureQuestionExists(questionId);

    const occurrences =
      await this.prisma.questionOccurrence.findMany({
        where: { questionId },
        include: this.occurrenceInclude,
        orderBy: [
          { examYear: 'desc' },
          { createdAt: 'desc' },
        ],
      });

    return {
      success: true,
      total: occurrences.length,
      data: occurrences,
    };
  }

  // ==========================================
  // GET ALL OCCURRENCES
  // ==========================================

  async findAll(query: {
    search?: string;
    questionId?: string;
    institutionId?: string;
    examId?: string;
    postId?: string;
    examYear?: number;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(
      100,
      Math.max(1, query.limit ?? 20),
    );

    const where: any = {};

    if (query.questionId) {
      where.questionId = query.questionId;
    }

    if (query.institutionId) {
      where.institutionId = query.institutionId;
    }

    if (query.examId) {
      where.examId = query.examId;
    }

    if (query.postId) {
      where.postId = query.postId;
    }

    if (query.examYear !== undefined) {
      where.examYear = query.examYear;
    }

    if (query.search?.trim()) {
      const search = query.search.trim();

      where.OR = [
        {
          institution: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          examName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          postName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          department: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          source: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [occurrences, total] =
      await this.prisma.$transaction([
        this.prisma.questionOccurrence.findMany({
          where,
          include: this.occurrenceInclude,
          orderBy: [
            { examYear: 'desc' },
            { createdAt: 'desc' },
          ],
          skip: (page - 1) * limit,
          take: limit,
        }),

        this.prisma.questionOccurrence.count({ where }),
      ]);

    return {
      success: true,
      data: occurrences,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==========================================
  // GET SINGLE OCCURRENCE
  // ==========================================

  async findOne(id: string) {
    const occurrence =
      await this.prisma.questionOccurrence.findUnique({
        where: { id },
        include: this.occurrenceInclude,
      });

    if (!occurrence) {
      throw new NotFoundException(
        'Question occurrence not found.',
      );
    }

    return {
      success: true,
      data: occurrence,
    };
  }

  // ==========================================
  // UPDATE QUESTION OCCURRENCE
  // ==========================================

  async update(id: string, dto: UpdateOccurrenceDto) {
    try {
      const updated = await this.prisma.$transaction(
        async (tx) => {
          const existing =
            await tx.questionOccurrence.findUnique({
              where: { id },
            });

          if (!existing) {
            throw new NotFoundException(
              'Question occurrence not found.',
            );
          }

          const hasChanges = Object.values(dto).some(
            (value) => value !== undefined,
          );

          if (!hasChanges) {
            throw new BadRequestException(
              'At least one field is required for update.',
            );
          }

          const requestedExamId =
            dto.examId !== undefined
              ? dto.examId
              : existing.examId;

          const requestedExamYear =
            dto.examYear !== undefined
              ? dto.examYear
              : requestedExamId === existing.examId
                ? existing.examYear
                : undefined;

          const references = await this.resolveReferences(
            {
              institution:
                dto.institution !== undefined
                  ? dto.institution
                  : existing.institution,

              examName:
                dto.examName !== undefined
                  ? dto.examName
                  : existing.examName,

              examYear: requestedExamYear,

              postName:
                dto.postName !== undefined
                  ? dto.postName
                  : existing.postName,

              source:
                dto.source !== undefined
                  ? dto.source
                  : existing.source,

              institutionId:
                dto.institutionId !== undefined
                  ? dto.institutionId
                  : existing.institutionId,

              examId: requestedExamId,

              postId:
                dto.postId !== undefined
                  ? dto.postId
                  : requestedExamId !== existing.examId
                    ? null
                    : existing.postId,

              sourceDocumentId:
                dto.sourceDocumentId !== undefined
                  ? dto.sourceDocumentId
                  : existing.sourceDocumentId,
            },
            tx,
          );

          const questionNumber =
            dto.questionNumber !== undefined
              ? dto.questionNumber
              : existing.questionNumber;

          await this.ensureNoDuplicate(
            {
              questionId: existing.questionId,
              ...references,
            },
            id,
            tx,
          );

          return tx.questionOccurrence.update({
            where: { id },
            data: {
              institution: references.institution,
              examName: references.examName,
              examYear: references.examYear,
              postName: references.postName,
              source: references.source,
              institutionId: references.institutionId,
              examId: references.examId,
              postId: references.postId,
              sourceDocumentId: references.sourceDocumentId,

              ...(dto.department !== undefined && {
                department: dto.department,
              }),

              ...(dto.questionNumber !== undefined && {
                questionNumber: dto.questionNumber,
              }),

              ...(dto.sourcePage !== undefined && {
                sourcePage: dto.sourcePage,
              }),

              ...(dto.sourceUrl !== undefined && {
                sourceUrl: dto.sourceUrl,
              }),
            },
            include: this.occurrenceInclude,
          });
        },
      );

      return {
        success: true,
        message: 'Question occurrence updated successfully.',
        data: updated,
      };
    } catch (error) {
      this.handleOccurrenceError(error);
    }
  }

  // ==========================================
  // DELETE QUESTION OCCURRENCE
  // ==========================================

  async remove(id: string) {
    const existing =
      await this.prisma.questionOccurrence.findUnique({
        where: { id },
        select: { id: true },
      });

    if (!existing) {
      throw new NotFoundException(
        'Question occurrence not found.',
      );
    }

    await this.prisma.questionOccurrence.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Question occurrence deleted successfully.',
    };
  }
}