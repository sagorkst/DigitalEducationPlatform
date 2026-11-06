
import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { CreateOccurrenceDto } from './dto/create-occurrence.dto';
import { UpdateOccurrenceDto } from './dto/update-occurrence.dto';

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

  private async resolveReferences(data: {
    institution?: string;
    examName?: string;
    postName?: string | null;
    source?: string | null;
    institutionId?: string | null;
    examId?: string | null;
    postId?: string | null;
    sourceDocumentId?: string | null;
  }) {
    let institution = data.institution;
    let examName = data.examName;
    let postName = data.postName;
    let source = data.source;

    let institutionId = data.institutionId;
    let examId = data.examId;
    let postId = data.postId;
    let sourceDocumentId = data.sourceDocumentId;

    let exam: any = null;

    if (examId) {
      exam = await this.prisma.exam.findUnique({
        where: { id: examId },
      });

      if (!exam) {
        throw new BadRequestException('Selected exam does not exist.');
      }

      if (institutionId && exam.institutionId !== institutionId) {
        throw new BadRequestException(
          'Selected exam does not belong to the selected institution.',
        );
      }

      if (!institutionId && exam.institutionId) {
        institutionId = exam.institutionId;
      }

      examName = exam.name;
    }

    if (institutionId) {
      const institutionRecord =
        await this.prisma.institution.findUnique({
          where: { id: institutionId },
        });

      if (!institutionRecord) {
        throw new BadRequestException(
          'Selected institution does not exist.',
        );
      }

      if (!institutionRecord.isActive) {
        throw new BadRequestException(
          'Cannot assign an inactive institution.',
        );
      }

      institution = institutionRecord.name;
    }

    if (postId) {
      const post = await this.prisma.post.findUnique({
        where: { id: postId },
      });

      if (!post) {
        throw new BadRequestException('Selected post does not exist.');
      }

      postName = post.name;
    }

    if (sourceDocumentId) {
      const document = await this.prisma.sourceDocument.findUnique({
        where: { id: sourceDocumentId },
      });

      if (!document) {
        throw new BadRequestException(
          'Selected source document does not exist.',
        );
      }

      source = document.title;
    }

    if (!institution || !examName) {
      throw new BadRequestException(
        'Institution and exam name are required.',
      );
    }

    return {
      institution,
      examName,
      postName: postName ?? null,
      source: source ?? null,
      institutionId: institutionId ?? null,
      examId: examId ?? null,
      postId: postId ?? null,
      sourceDocumentId: sourceDocumentId ?? null,
    };
  }

  private async ensureQuestionExists(questionId: string) {
    const question = await this.prisma.question.findFirst({
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

  private async ensureNoDuplicate(
    data: {
      questionId: string;
      examId?: string | null;
      examName: string;
      institution: string;
      examYear: number;
      postId?: string | null;
      postName?: string | null;
      questionNumber?: number | null;
    },
    excludeId?: string,
  ) {
    const where: any = {
      questionId: data.questionId,
      examYear: data.examYear,
      questionNumber: data.questionNumber ?? null,
    };

    if (data.examId) {
      where.examId = data.examId;
      where.postId = data.postId ?? null;
    } else {
      where.examId = null;
      where.institution = data.institution;
      where.examName = data.examName;
      where.postName = data.postName ?? null;
      where.postId = data.postId ?? null;
    }

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const duplicate = await this.prisma.questionOccurrence.findFirst({
      where,
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException(
        'This question occurrence already exists.',
      );
    }
  }

  async create(questionId: string, dto: CreateOccurrenceDto) {
    await this.ensureQuestionExists(questionId);

    const references = await this.resolveReferences(dto);

    await this.ensureNoDuplicate({
      questionId,
      ...references,
      examYear: dto.examYear,
      questionNumber: dto.questionNumber,
    });

    const occurrence = await this.prisma.questionOccurrence.create({
      data: {
        questionId,
        institution: references.institution,
        examName: references.examName,
        examYear: dto.examYear,
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

    return {
      success: true,
      message: 'Question occurrence created successfully.',
      data: occurrence,
    };
  }

  async findAllByQuestion(questionId: string) {
    await this.ensureQuestionExists(questionId);

    const occurrences = await this.prisma.questionOccurrence.findMany({
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
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

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
        { institution: { contains: search, mode: 'insensitive' } },
        { examName: { contains: search, mode: 'insensitive' } },
        { postName: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
        { source: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [occurrences, total] = await this.prisma.$transaction([
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

  async findOne(id: string) {
    const occurrence = await this.prisma.questionOccurrence.findUnique({
      where: { id },
      include: this.occurrenceInclude,
    });

    if (!occurrence) {
      throw new NotFoundException('Question occurrence not found.');
    }

    return {
      success: true,
      data: occurrence,
    };
  }

  async update(id: string, dto: UpdateOccurrenceDto) {
    const existing = await this.prisma.questionOccurrence.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Question occurrence not found.');
    }

    const hasChanges = Object.values(dto).some(
      (value) => value !== undefined,
    );

    if (!hasChanges) {
      throw new BadRequestException(
        'At least one field is required for update.',
      );
    }

    const references = await this.resolveReferences({
      institution:
        dto.institution ?? existing.institution,
      examName:
        dto.examName ?? existing.examName,
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
      examId:
        dto.examId !== undefined
          ? dto.examId
          : existing.examId,
      postId:
        dto.postId !== undefined
          ? dto.postId
          : existing.postId,
      sourceDocumentId:
        dto.sourceDocumentId !== undefined
          ? dto.sourceDocumentId
          : existing.sourceDocumentId,
    });

    const examYear = dto.examYear ?? existing.examYear;
    const questionNumber =
      dto.questionNumber !== undefined
        ? dto.questionNumber
        : existing.questionNumber;

    await this.ensureNoDuplicate(
      {
        questionId: existing.questionId,
        ...references,
        examYear,
        questionNumber,
      },
      id,
    );

    const updated = await this.prisma.questionOccurrence.update({
      where: { id },
      data: {
        institution: references.institution,
        examName: references.examName,
        examYear,
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

    return {
      success: true,
      message: 'Question occurrence updated successfully.',
      data: updated,
    };
  }

  async remove(id: string) {
    const existing = await this.prisma.questionOccurrence.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Question occurrence not found.');
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
