import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { randomBytes } from 'crypto';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateQuestionDto } from '../questions/dto/create-question.dto';

import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

type ImportFile = Express.Multer.File;
type ImportData = Record<string, unknown>;

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeText(value: string): string {
    return value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isValidUuid(value: unknown): value is string {
    return (
      typeof value === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
    );
  }

  private parseJsonValue(value: unknown): unknown {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return undefined;
    }

    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }

  private parseFile(file: ImportFile): ImportData[] {
    const extension = file.originalname.split('.').pop()?.toLowerCase();

    let rows: unknown[];

    try {
      if (extension === 'json') {
        const parsed = JSON.parse(file.buffer.toString('utf8'));
        rows = Array.isArray(parsed) ? parsed : parsed?.questions;
      } else if (extension === 'csv') {
        rows = parse(file.buffer, {
          columns: true,
          skip_empty_lines: true,
          bom: true,
          trim: true,
          relax_column_count: false,
        });
      } else if (extension === 'xlsx' || extension === 'xls') {
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

        if (!firstSheet) {
          throw new BadRequestException(
            'Excel file does not contain a worksheet.',
          );
        }

        rows = XLSX.utils.sheet_to_json(firstSheet, {
          defval: '',
          raw: false,
        });
      } else {
        throw new BadRequestException(
          'Unsupported file format. Use JSON, CSV or XLSX.',
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        'Unable to read the uploaded file. Please check its format.',
      );
    }

    if (!Array.isArray(rows)) {
      throw new BadRequestException(
        'Invalid file structure. JSON must contain an array or a questions array.',
      );
    }

    if (rows.length === 0) {
      throw new BadRequestException(
        'The uploaded file does not contain any question rows.',
      );
    }

    if (rows.length > 10000) {
      throw new BadRequestException(
        'Maximum 10000 rows are allowed per import batch.',
      );
    }

    return rows.map((row, index) => {
      if (
        typeof row !== 'object' ||
        row === null ||
        Array.isArray(row)
      ) {
        throw new BadRequestException(
          `Invalid data structure at row ${index + 1}.`,
        );
      }

      const data = { ...(row as ImportData) };

      const headerAliases: Record<string, string> = {
        questionid: 'sourceQuestionId',
        organization: 'institution',
        organizationname: 'institution',
        institutionname: 'institution',
        institution: 'institution',
        examname: 'examName',
        exam: 'examName',
        year: 'examYear',
        examyear: 'examYear',
        postname: 'postName',
        post: 'postName',
        department: 'department',
        questiontype: 'questionType',
        questiontext: 'questionText',
        optiona: 'optionA',
        optionb: 'optionB',
        optionc: 'optionC',
        optiond: 'optionD',
        correctanswer: 'correctAnswer',
        explanation: 'explanation',
        difficulty: 'difficulty',
        repeatgroupid: 'repeatGroupId',
        source: 'source',
        sourcepage: 'sourcePage',
        sourceurl: 'sourceUrl',
        status: 'status',
      };

      for (const [header, value] of Object.entries(data)) {
        const key = header.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '');
        const target = headerAliases[key];
        if (target && (data[target] === undefined || data[target] === null || String(data[target]).trim() === '')) {
          data[target] = value;
        }
      }
      // optionA-D contain choices. Correct_Answer may contain a letter or exact option text.
      // Legacy JSON options remain supported.
      if (!('options' in data)) {
        const letters = ['A', 'B', 'C', 'D'];
        const correctAnswerValue = String(data.correctAnswer ?? '').trim();
        const correctAnswerTokens = correctAnswerValue
          .split(/[,;|]/)
          .map((token) => token.trim())
          .filter(Boolean);

        const flatOptions: ImportData[] = [];

        letters.forEach((letter, index) => {
          const optionText = String(data[`option${letter}`] ?? '').trim();

          if (optionText) {
            flatOptions.push({
              label: letter,
              optionText,
              isCorrect: correctAnswerTokens.some(
                (token) =>
                  token.toUpperCase() === letter ||
                  token.toLowerCase() === optionText.toLowerCase(),
              ),
              sortOrder: index + 1,
            });
          }
        });

        if (flatOptions.length > 0) {
          data.options = flatOptions;
        }

        const selected = flatOptions.filter(
          (option) => option.isCorrect === true,
        );

        if (selected.length > 0) {
          data.correctAnswer = selected
            .map((option) => String(option.optionText))
            .join(', ');
        } else {
          delete data.correctAnswer;
        }
      }      // Separate exam columns -> occurrences array.
      // Existing JSON occurrences remain supported.
      if (!('occurrences' in data)) {
        const institution = String(
          data.institution ?? '',
        ).trim();

        const examName = String(
          data.examName ?? '',
        ).trim();

        const examId = String(
          data.examId ?? '',
        ).trim();

        if (institution || examName || examId) {
          const occurrence: ImportData = {
            institution,
            ...(examName ? { examName } : {}),
            ...(String(data.examYear ?? '').trim()
              ? { examYear: Number(data.examYear) }
              : {}),
            ...(data.postName
              ? { postName: String(data.postName).trim() }
              : {}),
            ...(data.department
              ? { department: String(data.department).trim() }
              : {}),
            ...(String(data.questionNumber ?? '').trim()
              ? { questionNumber: Number(data.questionNumber) }
              : {}),
            ...(data.source
              ? { source: String(data.source).trim() }
              : {}),
            ...(String(data.sourcePage ?? '').trim()
              ? { sourcePage: Number(data.sourcePage) }
              : {}),
            ...(data.sourceUrl
              ? { sourceUrl: String(data.sourceUrl).trim() }
              : {}),
            ...(data.institutionId
              ? { institutionId: String(data.institutionId).trim() }
              : {}),
            ...(examId ? { examId } : {}),
            ...(data.postId
              ? { postId: String(data.postId).trim() }
              : {}),
            ...(data.sourceDocumentId
              ? {
                  sourceDocumentId: String(
                    data.sourceDocumentId,
                  ).trim(),
                }
              : {}),
          };

          data.occurrences = [occurrence];
        }
      }

      if ('options' in data) {
        data.options = this.parseJsonValue(data.options);
      }

      if ('occurrences' in data) {
        data.occurrences = this.parseJsonValue(data.occurrences);
      }

      return data;
    });
  }

  private validateRow(data: ImportData): string[] {
    const errors: string[] = [];

    const questionText = data.questionText;
    const subject = data.subject;
    const topic = data.topic;

    const questionImages = data.imageReferences;
    const hasQuestionImages = Array.isArray(questionImages) &&
      questionImages.some((item) => typeof item === 'string' && item.trim().length > 0);

    if (typeof questionText !== 'string' || (!questionText.trim() && !hasQuestionImages)) {
      errors.push('Question text or at least one question image is required.');
    } else if (questionText.trim() && questionText.trim().length < 3) {
      errors.push('Question text must contain at least 3 characters.');
    } else if (questionText.length > 1000) {
      errors.push('Question text cannot exceed 1000 characters.');
    }
    if (questionImages !== undefined && (!Array.isArray(questionImages) || questionImages.some((item) => typeof item !== 'string'))) {
      errors.push('Question image references must be an array of strings.');
    }

    if (subject !== undefined && subject !== null && typeof subject !== 'string') {
      errors.push('Subject must be text.');
    } else if (typeof subject === 'string' && subject.length > 200) {
      errors.push('Subject cannot exceed 200 characters.');
    }

    if (topic !== undefined && topic !== null && typeof topic !== 'string') {
      errors.push('Topic must be text.');
    } else if (typeof topic === 'string' && topic.length > 200) {
      errors.push('Topic cannot exceed 200 characters.');
    }

    const questionType = data.questionType ?? 'MCQ';

    const allowedTypes = [
      'MCQ',
      'TRUE_FALSE',
      'FILL_IN_THE_BLANKS',
      'WRITTEN',
    ];

    if (
      typeof questionType !== 'string' ||
      !allowedTypes.includes(questionType)
    ) {
      errors.push('Invalid question type.');
    }

    const difficulty = data.difficulty ?? 'MEDIUM';

    if (!['EASY', 'MEDIUM', 'HARD'].includes(String(difficulty))) {
      errors.push('Invalid difficulty.');
    }

    const status = data.status ?? 'DRAFT';

    if (
      !['DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED'].includes(
        String(status),
      )
    ) {
      errors.push('Invalid question status.');
    }

    const options = data.options;

    if (options !== undefined && options !== null) {
      if (!Array.isArray(options)) {
        errors.push('Options must be an array.');
      } else {
        if (options.length > 4) {
          errors.push('A maximum of 4 options is allowed.');
        }

        const labels = new Set<string>();

        options.forEach((option, index) => {
          if (
            typeof option !== 'object' ||
            option === null ||
            Array.isArray(option)
          ) {
            errors.push(`Option ${index + 1} is invalid.`);
            return;
          }

          const item = option as ImportData;

          if (
            typeof item.label !== 'string' ||
            !item.label.trim()
          ) {
            errors.push(`Option ${index + 1} requires a label.`);
          } else {
            const label = item.label.trim().toUpperCase();

            if (labels.has(label)) {
              errors.push(`Duplicate option label: ${label}.`);
            }

            labels.add(label);
          }

          const optionImages = item.imageReferences;
          const hasOptionImages = Array.isArray(optionImages) &&
            optionImages.some((image) => typeof image === 'string' && image.trim().length > 0);
          if ((typeof item.optionText !== 'string' || !item.optionText.trim()) && !hasOptionImages) {
            errors.push(`Option ${index + 1} requires option text or at least one image.`);
          }
          if (optionImages !== undefined && (!Array.isArray(optionImages) || optionImages.some((image) => typeof image !== 'string'))) {
            errors.push(`Option ${index + 1} image references must be an array of strings.`);
          }

          if (
            item.isCorrect !== undefined &&
            typeof item.isCorrect !== 'boolean'
          ) {
            errors.push(
              `Option ${index + 1} has invalid isCorrect value.`,
            );
          }

        });
      }
    }

    const occurrences = data.occurrences;
    if (occurrences !== undefined && occurrences !== null && !Array.isArray(occurrences)) {
      errors.push('Occurrences must be an array.');
    } else if (Array.isArray(occurrences)) {
      occurrences.forEach((occurrence, index) => {
        if (!occurrence || typeof occurrence !== 'object' || Array.isArray(occurrence)) {
          errors.push(`Occurrence ${index + 1} is invalid.`);
          return;
        }
        const item = occurrence as ImportData;
        for (const [field, label] of [['institution', 'Institution'], ['examName', 'Exam name'], ['postName', 'Post name']] as const) {
          if (item[field] !== undefined && item[field] !== null && typeof item[field] !== 'string') {
            errors.push(`Occurrence ${index + 1}: ${label} must be text.`);
          }
        }
        if (item.examYear !== undefined && item.examYear !== null && String(item.examYear).trim() !== '') {
          const year = Number(item.examYear);
          if (!Number.isInteger(year) || year < 1900 || year > 2100) {
            errors.push(`Occurrence ${index + 1}: exam year must be between 1900 and 2100.`);
          }
        }
        for (const [field, label] of [['examId', 'Exam ID'], ['institutionId', 'Institution ID'], ['postId', 'Post ID'], ['sourceDocumentId', 'Source Document ID']] as const) {
          if (item[field] !== undefined && item[field] !== null && item[field] !== '' && !this.isValidUuid(item[field])) {
            errors.push(`Occurrence ${index + 1}: invalid ${label}.`);
          }
        }
      });
    }

    if (
      data.correctAnswer !== undefined &&
      typeof data.correctAnswer !== 'string'
    ) {
      errors.push('Correct answer must be text.');
    }

    if (
      data.explanation !== undefined &&
      typeof data.explanation !== 'string'
    ) {
      errors.push('Explanation must be text.');
    }

    return errors;
  }

  /**
   * Validates Exam references during preview.
   * The Exam record is the source of truth for linked occurrences.
   */
  private async validateOccurrenceReferences(
    data: ImportData,
  ): Promise<string[]> {
    const errors: string[] = [];

    if (!Array.isArray(data.occurrences)) {
      return errors;
    }

    for (let index = 0; index < data.occurrences.length; index++) {
      const occurrence = data.occurrences[index];

      if (
        typeof occurrence !== 'object' ||
        occurrence === null ||
        Array.isArray(occurrence)
      ) {
        continue;
      }

      const item = occurrence as ImportData;

      if (
        typeof item.examId !== 'string' ||
        !item.examId.trim() ||
        !this.isValidUuid(item.examId)
      ) {
        continue;
      }

      const exam = await this.prisma.exam.findUnique({
        where: {
          id: item.examId,
        },
        select: {
          id: true,
          institutionId: true,
          postId: true,
          name: true,
          examYear: true,
        },
      });

      if (!exam) {
        errors.push(
          `Occurrence ${index + 1}: selected Exam does not exist.`,
        );
        continue;
      }

      if (
        item.institutionId &&
        item.institutionId !== exam.institutionId
      ) {
        errors.push(
          `Occurrence ${index + 1}: Institution ID does not match the selected Exam.`,
        );
      }

      if (
        item.postId &&
        item.postId !== exam.postId
      ) {
        errors.push(
          `Occurrence ${index + 1}: Post ID does not match the selected Exam.`,
        );
      }
    }

    return errors;
  }

  /**
   * Find or create Institution, Post and Exam during import commit.
   */
  private async resolveOccurrenceForImport(
    tx: Prisma.TransactionClient,
    occurrence: NonNullable<CreateQuestionDto['occurrences']>[number] & { isPrimary?: boolean },
  ) {
    const institutionName = String(occurrence.institution ?? '').trim();
    const examName = String(occurrence.examName ?? '').trim();
    const rawYear = occurrence.examYear;
    const examYear = String(rawYear ?? '').trim() === '' ? null : Number(rawYear);

    let institution: { id: string; name: string } | null = null;
    if (occurrence.institutionId) {
      institution = await tx.institution.findUnique({
        where: { id: occurrence.institutionId },
        select: { id: true, name: true },
      });
      if (!institution) throw new BadRequestException('Selected Institution does not exist.');
    } else if (institutionName) {
      institution = await tx.institution.findFirst({
        where: { name: { equals: institutionName, mode: 'insensitive' } },
        select: { id: true, name: true },
      });
      if (!institution) {
        const slug = this.normalizeText(institutionName).replace(/\s+/g, '-').slice(0, 50) || 'institution';
        institution = await tx.institution.create({
          data: { name: institutionName, slug: `${slug}-${randomBytes(4).toString('hex')}`, isActive: true },
          select: { id: true, name: true },
        });
      }
    }

    let post: { id: string; name: string } | null = null;
    if (occurrence.postId) {
      post = await tx.post.findUnique({ where: { id: occurrence.postId }, select: { id: true, name: true } });
      if (!post) throw new BadRequestException('Selected Post does not exist.');
    } else if (occurrence.postName?.trim()) {
      const postName = occurrence.postName.trim();
      post = await tx.post.findFirst({ where: { name: { equals: postName, mode: 'insensitive' } }, select: { id: true, name: true } });
      if (!post) {
        const slug = this.normalizeText(postName).replace(/\s+/g, '-').slice(0, 50) || 'post';
        post = await tx.post.create({ data: { name: postName, slug: `${slug}-${randomBytes(4).toString('hex')}` }, select: { id: true, name: true } });
      }
    }

    let exam: { id: string; institutionId: string | null; postId: string | null; name: string; examYear: number } | null = null;
    if (occurrence.examId) {
      exam = await tx.exam.findUnique({
        where: { id: occurrence.examId },
        select: { id: true, institutionId: true, postId: true, name: true, examYear: true },
      });
      if (!exam) throw new BadRequestException('Selected Exam does not exist.');
      if (institution && exam.institutionId && exam.institutionId !== institution.id) {
        throw new BadRequestException('Institution does not match the selected Exam.');
      }
      if (post && exam.postId && exam.postId !== post.id) {
        throw new BadRequestException('Post does not match the selected Exam.');
      }
      if (!institution && exam.institutionId) {
        institution = await tx.institution.findUnique({ where: { id: exam.institutionId }, select: { id: true, name: true } });
      }
    } else if (examName && examYear !== null && Number.isInteger(examYear) && examYear >= 1900 && examYear <= 2100) {
      exam = await tx.exam.findFirst({
        where: {
          institutionId: institution?.id ?? null,
          postId: post?.id ?? null,
          examYear,
          name: { equals: examName, mode: 'insensitive' },
        },
        select: { id: true, institutionId: true, postId: true, name: true, examYear: true },
      });
      if (!exam) {
        const slug = this.normalizeText(`${examName}-${examYear}`).replace(/\s+/g, '-').slice(0, 50) || 'exam';
        exam = await tx.exam.create({
          data: { institutionId: institution?.id ?? null, postId: post?.id ?? null, name: examName, examYear, slug: `${slug}-${randomBytes(4).toString('hex')}` },
          select: { id: true, institutionId: true, postId: true, name: true, examYear: true },
        });
      }
    }

    return {
      institution: institution?.name ?? (institutionName || null),
      examName: exam?.name ?? (examName || null),
      examYear: exam?.examYear ?? (examYear !== null && Number.isInteger(examYear) ? examYear : null),
      postName: post?.name ?? (occurrence.postName?.trim() || null),
      department: occurrence.department ?? null,
      questionNumber: occurrence.questionNumber ?? null,
      source: occurrence.source ?? null,
      sourcePage: occurrence.sourcePage ?? null,
      sourceUrl: occurrence.sourceUrl ?? null,
      institutionId: institution?.id ?? null,
      examId: exam?.id ?? null,
      postId: exam?.postId ?? post?.id ?? null,
      sourceDocumentId: occurrence.sourceDocumentId ?? null,
      isPrimary: occurrence.isPrimary === true,
    };
  }
  /**
   * Creates a question using the current transaction.
   * Question, options and occurrences are committed together.
   */
  /**
   * Links only missing exam occurrences to an existing question.
   * Never creates or modifies the question or its options.
   */
  private async linkOccurrencesToExistingQuestionInTransaction(
    tx: Prisma.TransactionClient,
    questionId: string,
    dto: CreateQuestionDto,
  ): Promise<string[]> {
    const occurrenceIds: string[] = [];
    for (const occurrence of dto.occurrences ?? []) {
      const resolved = await this.resolveOccurrenceForImport(tx, occurrence);
      const year = resolved.examYear;
      const identityIsComplete = Boolean(
        resolved.institution && resolved.examName && year !== null,
      );
      if (identityIsComplete) {
        const existing = await tx.questionOccurrence.findMany({
          where: { questionId },
          select: { id: true, institution: true, examName: true, postName: true, examYear: true, isPrimary: true },
        });
        const same = existing.find((item) =>
          item.examYear !== null &&
          this.normalizeText(item.institution ?? '') === this.normalizeText(resolved.institution ?? '') &&
          this.normalizeText(item.examName ?? '') === this.normalizeText(resolved.examName ?? '') &&
          (!resolved.postName || this.normalizeText(item.postName ?? '') === this.normalizeText(resolved.postName)) &&
          item.examYear === year,
        );
        if (resolved.isPrimary) {
          await tx.questionOccurrence.updateMany({
            where: { questionId, isPrimary: true },
            data: { isPrimary: false },
          });
        }
        if (same) {
          if (resolved.isPrimary) {
            await tx.questionOccurrence.update({
              where: { id: same.id },
              data: { isPrimary: true },
            });
          }
          continue;
        }
      } else if (resolved.isPrimary) {
        await tx.questionOccurrence.updateMany({
          where: { questionId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      const created = await tx.questionOccurrence.create({
        data: { questionId, ...resolved },
        select: { id: true },
      });
      occurrenceIds.push(created.id);
    }
    return occurrenceIds;
  }
  private async createQuestionInTransaction(
    tx: Prisma.TransactionClient,
    dto: CreateQuestionDto,
  ) {
    const questionType = dto.questionType ?? 'MCQ';

    const questionCode =
      `Q-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;

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

    // Resolve all occurrence references inside the same transaction.
    const resolvedOccurrences: Awaited<ReturnType<ImportsService['resolveOccurrenceForImport']>>[] = [];
    const occurrenceKeys = new Set<string>();
    for (const occurrence of dto.occurrences ?? []) {
      const resolved = await this.resolveOccurrenceForImport(tx, occurrence);
      const year = resolved.examYear;
      if (resolved.institution && resolved.examName && resolved.postName && year !== null) {
        const key = [
          resolved.institution,
          resolved.examName,
          resolved.postName,
          String(year),
        ].map((value) => this.normalizeText(value)).join('|');
        if (occurrenceKeys.has(key)) continue;
        occurrenceKeys.add(key);
      }
      resolvedOccurrences.push(resolved);
    }

    return tx.question.create({
      data: {
        questionCode,
        questionText: dto.questionText,
        ...(dto.imageReferences?.length ? { imageReferences: dto.imageReferences as Prisma.InputJsonValue } : {}),
        questionType,
        subject: selectedSubject?.name ?? dto.subject ?? '',
        topic: selectedTopic?.name ?? dto.topic ?? '',
        ...(selectedSubject
          ? { subjectRef: { connect: { id: selectedSubject.id } } }
          : {}),
        ...(selectedTopic
          ? { topicRef: { connect: { id: selectedTopic.id } } }
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
          create: resolvedOccurrences,
        },
      },
      include: {
        occurrences: {
          select: { id: true },
        },
      },
    });
  }

  async previewParsedRows(
    rows: ImportData[],
    fileName: string,
    fileType = 'html',
  ) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException('No questions were extracted from HTML.');
    }

    const virtualFile = {
      originalname: fileName,
      buffer: Buffer.from('html-import'),
      size: 11,
    } as ImportFile;

    return this.preview(virtualFile, rows, fileType);
  }

  async preview(
    file: ImportFile,
    parsedRows?: ImportData[],
    sourceFileType?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }

    if (!file.buffer || file.size === 0) {
      throw new BadRequestException('Uploaded file is empty.');
    }

    const rows = parsedRows ?? this.parseFile(file);

    const batch = await this.prisma.importBatch.create({
      data: {
        fileName: file.originalname,
        fileType: sourceFileType ?? file.originalname.split('.').pop()?.toLowerCase() ?? 'unknown',
        status: 'PROCESSING',
        totalRows: rows.length,
        startedAt: new Date(),
      },
    });

    const preparedRows: Prisma.ImportRowCreateManyInput[] = [];

    let validRows = 0;
    let invalidRows = 0;
    let duplicateRows = 0;

    const seenQuestions = new Set<string>();
    const seenImageQuestions = new Set<string>();

    try {
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];

        const errors = this.validateRow(row);

        if (errors.length === 0) {
          const referenceErrors =
            await this.validateOccurrenceReferences(row);

          errors.push(...referenceErrors);
        }

        let rowStatus: 'VALID' | 'INVALID' | 'DUPLICATE' = 'VALID';

        if (errors.length > 0) {
          rowStatus = 'INVALID';
          invalidRows++;
        } else {
          const questionText = String(row.questionText ?? '');
          const normalized = this.normalizeText(questionText);
          const questionImages = Array.isArray(row.imageReferences)
            ? row.imageReferences.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            : [];
          const imageFingerprint = questionImages.length > 0
            ? questionImages.map((item) => item.trim()).sort().join('|')
            : '';

          if ((normalized && seenQuestions.has(normalized)) || (imageFingerprint && seenImageQuestions.has(imageFingerprint))) {
            rowStatus = 'DUPLICATE';
            errors.push(
              'Duplicate question found within this import file.',
            );
            duplicateRows++;
          } else {
            if (normalized) seenQuestions.add(normalized);
            if (imageFingerprint) seenImageQuestions.add(imageFingerprint);

            const existing = normalized
              ? await this.prisma.question.findFirst({
                  where: {
                    deletedAt: null,
                    questionText: { equals: questionText, mode: 'insensitive' },
                  },
                  select: { id: true },
                })
              : questionImages.length > 0
                ? await this.prisma.question.findFirst({
                    where: {
                      deletedAt: null,
                      imageReferences: { equals: questionImages as Prisma.InputJsonValue },
                    },
                    select: { id: true },
                  })
                : null;

            if (existing) {
              rowStatus = 'DUPLICATE';
              errors.push(
                'An identical question already exists in the question bank.',
              );
              duplicateRows++;
            } else {
              validRows++;
            }
          }
        }

        preparedRows.push({
          batchId: batch.id,
          rowNumber: index + 1,
          rawData: row as Prisma.InputJsonValue,
          status: rowStatus,
          errorMessages:
            errors.length > 0
              ? (errors as Prisma.InputJsonValue)
              : Prisma.JsonNull,
        });
      }

      const updatedBatch = await this.prisma.$transaction(
        async (tx) => {
          await tx.importRow.createMany({
            data: preparedRows,
          });

          return tx.importBatch.update({
            where: {
              id: batch.id,
            },
            data: {
              status: 'REVIEW',
              validRows,
              invalidRows,
              duplicateRows,
              completedAt: new Date(),
            },
          });
        },
      );

      return {
        success: true,
        message: 'Import preview generated successfully.',
        data: {
          batch: updatedBatch,
          summary: {
            totalRows: rows.length,
            validRows,
            invalidRows,
            duplicateRows,
          },
        },
      };
    } catch (error) {
      await this.prisma.importBatch.update({
        where: {
          id: batch.id,
        },
        data: {
          status: 'FAILED',
          errorSummary: {
            message:
              error instanceof Error
                ? error.message
                : 'Unknown import error',
          },
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }

  async findAll(page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));

    const [data, total] = await this.prisma.$transaction([
      this.prisma.importBatch.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        include: {
          _count: {
            select: {
              rows: true,
            },
          },
        },
      }),
      this.prisma.importBatch.count(),
    ]);

    return {
      success: true,
      data,
      pagination: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async findOne(id: string) {
    const batch = await this.prisma.importBatch.findUnique({
      where: {
        id,
      },
      include: {
        rows: {
          orderBy: {
            rowNumber: 'asc',
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Import batch not found.');
    }

    return {
      success: true,
      data: batch,
    };
  }

  private async revalidateBatchRows(
    tx: Prisma.TransactionClient,
    batchId: string,
  ) {
    const rows = await tx.importRow.findMany({
      where: {
        batchId,
        status: {
          in: ['PENDING', 'VALID', 'INVALID', 'DUPLICATE'],
        },
      },
      orderBy: { rowNumber: 'asc' },
    });

    let validRows = 0;
    let invalidRows = 0;
    let duplicateRows = 0;
    const seenQuestions = new Set<string>();
    const seenImageQuestions = new Set<string>();

    for (const row of rows) {
      const data =
        row.rawData &&
        typeof row.rawData === 'object' &&
        !Array.isArray(row.rawData)
          ? (row.rawData as unknown as ImportData)
          : {};

      const errors = this.validateRow(data);

      if (errors.length === 0) {
        errors.push(...await this.validateOccurrenceReferences(data));
      }

      let rowStatus: 'VALID' | 'INVALID' | 'DUPLICATE' = 'VALID';

      if (errors.length > 0) {
        rowStatus = 'INVALID';
        invalidRows++;
      } else {
        const reviewOverride =
          data._importReviewOverride &&
          typeof data._importReviewOverride === 'object' &&
          !Array.isArray(data._importReviewOverride)
            ? (data._importReviewOverride as Record<string, unknown>)
            : undefined;

        const questionText = String(data.questionText ?? '');
        const normalized = this.normalizeText(questionText);
        const questionImages = Array.isArray(data.imageReferences)
          ? data.imageReferences.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          : [];
        const imageFingerprint = questionImages.length > 0
          ? questionImages.map((item) => item.trim()).sort().join('|')
          : '';
        const isDuplicateInBatch =
          (normalized.length > 0 && seenQuestions.has(normalized)) ||
          (imageFingerprint.length > 0 && seenImageQuestions.has(imageFingerprint));

        // Approved rows still become comparison candidates for subsequent rows.
        if (normalized) seenQuestions.add(normalized);
        if (imageFingerprint) seenImageQuestions.add(imageFingerprint);

        if (reviewOverride?.duplicate === 'PASS') {
          validRows++;
        } else if (isDuplicateInBatch) {
          rowStatus = 'DUPLICATE';
          errors.push('Duplicate question found within this import file.');
          duplicateRows++;
        } else {
          const existing = normalized
            ? await tx.question.findFirst({
                where: {
                  deletedAt: null,
                  questionText: { equals: questionText, mode: 'insensitive' },
                },
                select: { id: true },
              })
            : questionImages.length > 0
              ? await tx.question.findFirst({
                  where: {
                    deletedAt: null,
                    imageReferences: { equals: questionImages as Prisma.InputJsonValue },
                  },
                  select: { id: true },
                })
              : null;

          if (existing) {
            rowStatus = 'DUPLICATE';
            errors.push('An identical question already exists in the question bank.');
            duplicateRows++;
          } else {
            validRows++;
          }
        }
      }

      await tx.importRow.update({
        where: { id: row.id },
        data: {
          status: rowStatus,
          errorMessages: errors.length > 0
            ? (errors as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });
    }

    await tx.importBatch.update({
      where: { id: batchId },
      data: { validRows, invalidRows, duplicateRows },
    });

    return {
      totalRows: rows.length,
      validRows,
      invalidRows,
      duplicateRows,
    };
  }

  async applyBatchMetadata(
    batchId: string,
    metadata: {
      setAsPrimary?: unknown;
      institution?: unknown;
      examName?: unknown;
      examYear?: unknown;
      postName?: unknown;
      department?: unknown;
      occurrences?: unknown;
      rowIds?: unknown;
      applyTo?: unknown;
      overwriteExisting?: unknown;
    },
  ) {
    const cleanText = (value: unknown): string | undefined => {
      if (value === undefined || value === null) return undefined;
      if (typeof value !== 'string' && typeof value !== 'number') {
        throw new BadRequestException('Metadata values must be text or numbers.');
      }
      const result = String(value).trim();
      return result || undefined;
    };

    const common = {
      institution: cleanText(metadata.institution),
      examName: cleanText(metadata.examName),
      examYear: undefined as number | undefined,
      postName: cleanText(metadata.postName),
      department: cleanText(metadata.department),
    };

    if (metadata.examYear !== undefined && metadata.examYear !== null &&
        String(metadata.examYear).trim() !== '') {
      common.examYear = Number(metadata.examYear);
      if (!Number.isInteger(common.examYear) || common.examYear < 1900 || common.examYear > 2100) {
        throw new BadRequestException('Exam year must be between 1900 and 2100.');
      }
    }

    const setAsPrimary = metadata.setAsPrimary === true;
    if (metadata.setAsPrimary !== undefined && typeof metadata.setAsPrimary !== 'boolean') {
      throw new BadRequestException('setAsPrimary must be a boolean.');
    }

    const suppliedOccurrences = metadata.occurrences;
    if (suppliedOccurrences !== undefined && !Array.isArray(suppliedOccurrences)) {
      throw new BadRequestException('Occurrences must be an array.');
    }

    const cleanOccurrences: Record<string, unknown>[] = (Array.isArray(suppliedOccurrences)
      ? suppliedOccurrences
      : []).map((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          throw new BadRequestException(`Occurrence ${index + 1} must be an object.`);
        }
        const occurrence = { ...(item as Record<string, unknown>) };
        const cleaned: Record<string, unknown> = {};
        for (const key of [
          'institution', 'examName', 'postName', 'department', 'source', 'sourceUrl',
          'examId', 'institutionId', 'postId', 'sourceDocumentId',
        ]) {
          const value = cleanText(occurrence[key]);
          if (value !== undefined) cleaned[key] = value;
        }
        for (const key of ['examYear', 'questionNumber', 'sourcePage']) {
          const value = occurrence[key];
          if (value !== undefined && value !== null && String(value).trim() !== '') {
            const number = Number(value);
            const min = key === 'examYear' ? 1900 : 1;
            const max = key === 'examYear' ? 2100 : 1000000;
            if (!Number.isInteger(number) || number < min || number > max) {
              throw new BadRequestException(`Occurrence ${index + 1}: invalid ${key}.`);
            }
            cleaned[key] = number;
          }
        }
        if (cleaned.examYear === undefined && common.examYear !== undefined) {
          cleaned.examYear = common.examYear;
        }
        if (!cleaned.institution && common.institution) cleaned.institution = common.institution;
        if (!cleaned.postName && common.postName) cleaned.postName = common.postName;
        if (!cleaned.department && common.department) cleaned.department = common.department;
        return cleaned;
      });

    const rowIds = Array.isArray(metadata.rowIds)
      ? [...new Set(metadata.rowIds.map((id) => cleanText(id)).filter((id): id is string => Boolean(id)))]
      : undefined;
    const applyTo = metadata.applyTo === 'selected' ? 'selected' : 'all';
    const overwriteExisting = metadata.overwriteExisting === true;

    if (applyTo === 'selected' && (!rowIds || rowIds.length === 0)) {
      throw new BadRequestException('Select at least one import row.');
    }

    const hasCommonMetadata = Object.values(common).some((value) => value !== undefined);
    if (!hasCommonMetadata && cleanOccurrences.length === 0) {
      throw new BadRequestException('Provide at least one metadata field or exam occurrence.');
    }
    if (setAsPrimary && !common.examName && !cleanOccurrences.some((item) => cleanText(item.examName))) {
      throw new BadRequestException('Exam name is required to set a primary occurrence.');
    }

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.importBatch.findUnique({
        where: { id: batchId },
        select: { id: true, status: true },
      });
      if (!batch) throw new NotFoundException('Import batch not found.');
      if (batch.status !== 'REVIEW') {
        throw new BadRequestException('Only batches in REVIEW status can be edited.');
      }

      const rows = await tx.importRow.findMany({
        where: {
          batchId,
          status: { in: ['PENDING', 'VALID', 'INVALID', 'DUPLICATE'] },
          ...(applyTo === 'selected' && rowIds ? { id: { in: rowIds } } : {}),
        },
        select: { id: true, rawData: true },
      });

      if (rows.length === 0) {
        throw new BadRequestException('No editable import rows matched this selection.');
      }

      const assignValue = (
        target: Record<string, unknown>,
        key: string,
        value: unknown,
      ) => {
        if (value === undefined) return;
        const current = target[key];
        if (overwriteExisting || current === undefined || current === null || String(current).trim() === '') {
          target[key] = value;
        }
      };

      for (const row of rows) {
        const data = row.rawData && typeof row.rawData === 'object' && !Array.isArray(row.rawData)
          ? ({ ...(row.rawData as Record<string, unknown>) } as ImportData)
          : {};
        const existingOccurrences: Record<string, unknown>[] = Array.isArray(data.occurrences)
          ? data.occurrences.map((item) =>
              item && typeof item === 'object' && !Array.isArray(item)
                ? { ...(item as Record<string, unknown>) }
                : {},
            )
          : [];

        if (cleanOccurrences.length > 0) {
          for (const addition of cleanOccurrences) {
            const next = { ...common, ...addition } as Record<string, unknown>;
            const keyFor = (item: Record<string, unknown>): string | null => {
              const institution = String(item.institution ?? '').trim();
              const examName = String(item.examName ?? '').trim();
              const postName = String(item.postName ?? '').trim();
              const year = Number(item.examYear);
              if (!institution || !examName || !postName || !Number.isInteger(year)) return null;
              return [institution, examName, postName, String(year)]
                .map((value) => this.normalizeText(value))
                .join('|');
            };
            const key = keyFor(next);
            const existing = key
              ? existingOccurrences.find((item) => keyFor(item) === key)
              : undefined;
            if (existing) {
              for (const [field, value] of Object.entries(next)) assignValue(existing, field, value);
            } else {
              existingOccurrences.push(next);
            }
          }
        } else {
          if (existingOccurrences.length === 0) existingOccurrences.push({});
          const target = setAsPrimary && common.examName
            ? (existingOccurrences.find((item) =>
                this.normalizeText(String(item.examName ?? '')) === this.normalizeText(common.examName ?? '') &&
                (common.examYear === undefined || Number(item.examYear) === common.examYear),
              ) ?? existingOccurrences[0])
            : existingOccurrences[0];
          for (const [field, value] of Object.entries(common)) assignValue(target, field, value);
        }

        if (setAsPrimary) {
          const primaryCandidate = cleanOccurrences.length > 0
            ? ({ ...common, ...cleanOccurrences[0] } as Record<string, unknown>)
            : ({ ...common } as Record<string, unknown>);
          const identityFields = ['institution', 'examName', 'postName', 'examYear']
            .filter((field) => primaryCandidate[field] !== undefined && primaryCandidate[field] !== null && String(primaryCandidate[field]).trim() !== '');
          const primaryIndex = existingOccurrences.findIndex((item) =>
            identityFields.length > 0 && identityFields.every((field) => {
              const left = primaryCandidate[field];
              const right = item[field];
              if (field === 'examYear') return Number(left) === Number(right);
              return this.normalizeText(String(left ?? '')) === this.normalizeText(String(right ?? ''));
            }),
          );
          if (primaryIndex < 0) existingOccurrences.push(primaryCandidate);
          const resolvedPrimaryIndex = primaryIndex >= 0 ? primaryIndex : existingOccurrences.length - 1;
          existingOccurrences.forEach((item, index) => { item.isPrimary = index === resolvedPrimaryIndex; });
        }

        data.occurrences = existingOccurrences;
        await tx.importRow.update({
          where: { id: row.id },
          data: { rawData: data as Prisma.InputJsonValue },
        });
      }

      const summary = await this.revalidateBatchRows(tx, batchId);
      return {
        success: true,
        message: 'Batch metadata applied successfully.',
        data: { batchId, updatedRows: rows.length, summary },
      };
    });
  }

  async reviewDuplicates(
    batchId: string,
    rowIds: string[],
    action: 'PASS' | 'RECHECK',
  ) {
    if (!Array.isArray(rowIds) || rowIds.length === 0) {
      throw new BadRequestException('Select at least one duplicate row.');
    }

    const uniqueRowIds = [...new Set(rowIds.filter((id) => typeof id === 'string'))];
    if (uniqueRowIds.length === 0 || uniqueRowIds.length > 10000) {
      throw new BadRequestException('Invalid duplicate row selection.');
    }

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.importBatch.findUnique({
        where: { id: batchId },
        select: { id: true, status: true },
      });

      if (!batch) throw new NotFoundException('Import batch not found.');
      if (batch.status !== 'REVIEW') {
        throw new BadRequestException('Duplicate review is only available while the batch is in REVIEW status.');
      }

      const rows = await tx.importRow.findMany({
        where: {
          batchId,
          id: { in: uniqueRowIds },
          status: { in: ['DUPLICATE', 'VALID'] },
        },
        select: { id: true, rawData: true },
      });

      if (rows.length === 0) {
        throw new NotFoundException('No reviewable duplicate rows were found.');
      }

      for (const row of rows) {
        const data =
          row.rawData && typeof row.rawData === 'object' && !Array.isArray(row.rawData)
            ? { ...(row.rawData as Record<string, unknown>) }
            : {};

        if (action === 'PASS') {
          data._importReviewOverride = {
            duplicate: 'PASS',
            reviewedAt: new Date().toISOString(),
          };
        } else {
          delete data._importReviewOverride;
        }

        await tx.importRow.update({
          where: { id: row.id },
          data: { rawData: data as Prisma.InputJsonValue },
        });
      }

      const summary = await this.revalidateBatchRows(tx, batchId);

      return {
        success: true,
        message: action === 'PASS'
          ? 'Selected duplicate rows were manually approved.'
          : 'Selected rows were returned to automatic duplicate checking.',
        data: { batchId, updatedRows: rows.length, summary },
      };
    });
  }

  async updateImportRow(
    batchId: string,
    rowId: string,
    rawData: unknown,
  ) {
    if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
      throw new BadRequestException('Question data must be a valid object.');
    }

    let serialized: string;

    try {
      serialized = JSON.stringify(rawData);
    } catch {
      throw new BadRequestException('Invalid question data.');
    }

    if (!serialized || serialized.length > 500000) {
      throw new BadRequestException('Question data exceeds the allowed size.');
    }

    const cleanData = JSON.parse(serialized) as ImportData;

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.importBatch.findUnique({
        where: { id: batchId },
        select: { id: true, status: true },
      });

      if (!batch) throw new NotFoundException('Import batch not found.');

      if (batch.status !== 'REVIEW') {
        throw new BadRequestException('Only batches in REVIEW status can be edited.');
      }

      const row = await tx.importRow.findFirst({
        where: {
          id: rowId,
          batchId,
          status: { in: ['PENDING', 'VALID', 'INVALID', 'DUPLICATE'] },
        },
        select: { id: true },
      });

      if (!row) throw new NotFoundException('Editable import row not found.');

      await tx.importRow.update({
        where: { id: rowId },
        data: { rawData: cleanData as Prisma.InputJsonValue },
      });

      const summary = await this.revalidateBatchRows(tx, batchId);

      const updatedRow = await tx.importRow.findUnique({
        where: { id: rowId },
      });

      return {
        success: true,
        message: 'Import row updated successfully.',
        data: { row: updatedRow, summary },
      };
    });
  }
  async findRows(
    batchId: string,
    status?: string,
    page = 1,
    limit = 50,
  ) {
    const batch = await this.prisma.importBatch.findUnique({
      where: {
        id: batchId,
      },
      select: {
        id: true,
      },
    });

    if (!batch) {
      throw new NotFoundException('Import batch not found.');
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));

    const where: Prisma.ImportRowWhereInput = {
      batchId,
    };

    if (status) {
      const allowedStatuses = [
        'PENDING',
        'VALID',
        'INVALID',
        'DUPLICATE',
        'IMPORTED',
        'SKIPPED',
      ];

      if (!allowedStatuses.includes(status)) {
        throw new BadRequestException(
          'Invalid import row status.',
        );
      }

      where.status =
        status as Prisma.EnumImportRowStatusFilter['equals'];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.importRow.findMany({
        where,
        orderBy: {
          rowNumber: 'asc',
        },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.importRow.count({
        where,
      }),
    ]);

    return {
      success: true,
      data,
      pagination: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async commit(
    batchId: string,
    rowIds?: string[],
    allRows = false,
    excludedRowIds: string[] = [],
  ) {
    if (!allRows && (!Array.isArray(rowIds) || rowIds.length === 0)) {
      throw new BadRequestException('Select at least one row or choose all rows.');
    }

    const where: Prisma.ImportRowWhereInput = {
      batchId,
      status: {
        in: ['VALID', 'DUPLICATE'],
      },
    };

    if (!allRows && rowIds && rowIds.length > 0) {
      where.id = { in: rowIds };
    } else if (allRows && excludedRowIds.length > 0) {
      where.id = { notIn: excludedRowIds };
    }

    const rows = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.importBatch.updateMany({
        where: {
          id: batchId,
          status: 'REVIEW',
        },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
          completedAt: null,
        },
      });

      if (claimed.count !== 1) {
        const existing = await tx.importBatch.findUnique({
          where: { id: batchId },
          select: { id: true },
        });

        if (!existing) {
          throw new NotFoundException('Import batch not found.');
        }

        throw new BadRequestException(
          'This batch is not available for processing. It may already be processing.',
        );
      }

      const selectedRows = await tx.importRow.findMany({
        where,
        orderBy: { rowNumber: 'asc' },
      });

      if (selectedRows.length === 0) {
        throw new BadRequestException(
          'No valid or duplicate rows available for import.',
        );
      }

      return selectedRows;
    });

    let importedRows = 0;
    let failedRows = 0;

    const questionIdsByText = new Map<string, string>();

    for (const row of rows) {
      try {
        const rawData = row.rawData as Record<string, unknown>;
        const dto = rawData as unknown as CreateQuestionDto;
        const normalizedText = this.normalizeText(
          String(dto.questionText ?? ''),
        );
        const imageReferences = Array.isArray(dto.imageReferences)
          ? dto.imageReferences.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          : [];
        const imageFingerprint = imageReferences.length > 0
          ? imageReferences.map((item) => item.trim()).sort().join('|')
          : '';
        const identityKey = normalizedText || (imageFingerprint ? `image:${imageFingerprint}` : '');

        let processedQuestionId = '';

        await this.prisma.$transaction(async (tx) => {
          let questionId = identityKey ? questionIdsByText.get(identityKey) ?? null : null;
          let action: 'CREATED_QUESTION' | 'LINKED_OCCURRENCE' =
            'LINKED_OCCURRENCE';
          let occurrenceIds: string[] = [];

          if (!questionId) {
            const existingQuestion = normalizedText
              ? await tx.question.findFirst({
                  where: {
                    deletedAt: null,
                    questionText: { equals: dto.questionText, mode: 'insensitive' },
                  },
                  select: { id: true },
                })
              : imageReferences.length > 0
                ? await tx.question.findFirst({
                    where: {
                      deletedAt: null,
                      imageReferences: { equals: imageReferences as Prisma.InputJsonValue },
                    },
                    select: { id: true },
                  })
                : null;

            questionId = existingQuestion?.id ?? null;
          }

          if (!questionId && row.status === 'DUPLICATE') {
            throw new BadRequestException(
              'The original question was not found. Include its original row in the commit selection and try again.',
            );
          }

          if (!questionId && row.status === 'VALID') {
            const createdQuestion = await this.createQuestionInTransaction(
              tx,
              dto,
            );

            questionId = createdQuestion.id;
            action = 'CREATED_QUESTION';
            occurrenceIds = (createdQuestion.occurrences ?? []).map(
              (occurrence) => occurrence.id,
            );
          } else if (questionId) {
            occurrenceIds =
              await this.linkOccurrencesToExistingQuestionInTransaction(
                tx,
                questionId,
                dto,
              );
          }

          if (!questionId) {
            throw new BadRequestException(
              'Unable to resolve the question for this import row.',
            );
          }

          const trackedRawData = {
            ...rawData,
            _importTracking: {
              action,
              occurrenceIds,
            },
          } as Prisma.InputJsonValue;

          const updatedRow = await tx.importRow.updateMany({
            where: {
              id: row.id,
              batchId,
              status: row.status,
            },
            data: {
              status: 'IMPORTED',
              questionId,
              rawData: trackedRawData,
              errorMessages: Prisma.JsonNull,
            },
          });

          if (updatedRow.count !== 1) {
            throw new BadRequestException(
              'Import row is no longer available for processing.',
            );
          }

          processedQuestionId = questionId;
        });

        if (processedQuestionId && identityKey) {
          questionIdsByText.set(identityKey, processedQuestionId);
        }

        importedRows++;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Question import failed.';

        const failedUpdate = await this.prisma.importRow.updateMany({
          where: {
            id: row.id,
            batchId,
            status: row.status,
          },
          data: {
            status: 'INVALID',
            errorMessages: [errorMessage],
          },
        });

        if (failedUpdate.count === 1) {
          failedRows++;
        }
      }
    }

    const finalBatch = await this.prisma.$transaction(async (tx) => {
      const remainingImportable = await tx.importRow.count({
        where: {
          batchId,
          status: {
            in: ['VALID', 'DUPLICATE'],
          },
        },
      });

      const updated = await tx.importBatch.updateMany({
        where: {
          id: batchId,
          status: 'PROCESSING',
        },
        data: {
          status: remainingImportable > 0 ? 'REVIEW' : 'COMPLETED',
          importedRows: {
            increment: importedRows,
          },
          invalidRows: {
            increment: failedRows,
          },
          completedAt: new Date(),
        },
      });

      if (updated.count !== 1) {
        throw new BadRequestException(
          'Import batch status changed unexpectedly.',
        );
      }

      return tx.importBatch.findUniqueOrThrow({
        where: { id: batchId },
      });
    });

    const remainingImportableRows = await this.prisma.importRow.count({
      where: {
        batchId,
        status: {
          in: ['VALID', 'DUPLICATE'],
        },
      },
    });

    const remainingDuplicateRows = await this.prisma.importRow.count({
      where: {
        batchId,
        status: 'DUPLICATE',
      },
    });

    return {
      success: true,
      message: 'Import processing completed.',
      data: {
        batch: finalBatch,
        importedRows,
        failedRows,
        remainingValidRows: remainingImportableRows,
        remainingDuplicateRows,
      },
    };
  }

  async skipRows(
    batchId: string,
    rowIds?: string[],
    allRows = false,
    excludedRowIds: string[] = [],
  ) {
    if (!allRows && (!Array.isArray(rowIds) || rowIds.length === 0)) {
      throw new BadRequestException('Select at least one row or choose all rows.');
    }

    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.importBatch.updateMany({
        where: { id: batchId, status: 'REVIEW' },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
          completedAt: null,
        },
      });

      if (claimed.count !== 1) {
        const batch = await tx.importBatch.findUnique({
          where: { id: batchId },
          select: { id: true },
        });
        if (!batch) throw new NotFoundException('Import batch not found.');
        throw new BadRequestException(
          'Rows can only be skipped while the batch is in REVIEW status.',
        );
      }

      const result = await tx.importRow.updateMany({
        where: {
          batchId,
          ...(!allRows
            ? { id: { in: rowIds ?? [] } }
            : excludedRowIds.length > 0
              ? { id: { notIn: excludedRowIds } }
              : {}),
          status: { in: ['PENDING', 'VALID', 'INVALID', 'DUPLICATE'] },
        },
        data: { status: 'SKIPPED' },
      });

      if (result.count > 0) {
        await tx.importBatch.update({
          where: { id: batchId },
          data: { skippedRows: { increment: result.count } },
        });
      }

      const remainingRows = await tx.importRow.count({
        where: {
          batchId,
          status: { in: ['PENDING', 'VALID', 'INVALID', 'DUPLICATE'] },
        },
      });

      const finalBatch = await tx.importBatch.update({
        where: { id: batchId },
        data: {
          status: remainingRows > 0 ? 'REVIEW' : 'COMPLETED',
          completedAt: new Date(),
        },
      });

      return {
        success: true,
        message: allRows
          ? 'All review rows skipped successfully.'
          : 'Selected rows skipped successfully.',
        data: {
          skippedRows: result.count,
          remainingRows,
          batchStatus: finalBatch.status,
        },
      };
    });
  }
}
