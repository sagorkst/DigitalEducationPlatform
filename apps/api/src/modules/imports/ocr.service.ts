import { Injectable, BadRequestException } from '@nestjs/common';
import { createWorker } from 'tesseract.js';
import { createCanvas } from '@napi-rs/canvas';

type OcrPageResult = {
  page: number;
  text: string;
  confidence: number;
  method: 'TEXT' | 'OCR';
};

type ParsedQuestion = {
  questionNumber: number | null;
  questionText: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D' | null;
  sourcePage: number;
  reviewRequired: boolean;
  reviewReasons: string[];
  rawText: string;
};

type ParsedOptionLine = {
  label: 'A' | 'B' | 'C' | 'D' | null;
  text: string;
  ambiguous: boolean;
};

@Injectable()
export class OcrService {
  private readonly maxFileSize = 10 * 1024 * 1024;
  private readonly maxPdfPages = 20;

  async extractText(file: Express.Multer.File) {
    if (!file?.buffer || file.size === 0) {
      throw new BadRequestException('Please upload a valid file.');
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException('Maximum file size is 10 MB.');
    }

    const extension = file.originalname
      .split('.')
      .pop()
      ?.toLowerCase();

    if (!['pdf', 'png', 'jpg', 'jpeg'].includes(extension ?? '')) {
      throw new BadRequestException(
        'Only PDF, PNG, JPG and JPEG files are supported.',
      );
    }

    const result =
      extension === 'pdf'
        ? await this.extractFromPdf(file.buffer)
        : await this.extractFromImage(file.buffer);

    const parsedQuestions = this.parseQuestions(result.pages);

    if (parsedQuestions.length > 200) {
      throw new BadRequestException(
        'A single OCR import can contain a maximum of 200 questions.',
      );
    }

    return {
      ...result,
      parsedQuestions,
      parserSummary: {
        totalQuestions: parsedQuestions.length,
        reviewRequired: parsedQuestions.filter(
          (question) => question.reviewRequired,
        ).length,
        readyForReview: parsedQuestions.filter(
          (question) => !question.reviewRequired,
        ).length,
        savedToQuestionBank: false,
      },
    };
  }

  private async createOcrWorker() {
    return createWorker('eng+ben');
  }

  private async extractFromImage(buffer: Buffer) {
    const worker = await this.createOcrWorker();

    try {
      const result = await worker.recognize(buffer);

      const page: OcrPageResult = {
        page: 1,
        text: result.data.text.trim(),
        confidence: Math.round(result.data.confidence),
        method: 'OCR',
      };

      return {
        success: true,
        language: 'eng+ben',
        totalPages: 1,
        text: page.text,
        pages: [page],
      };
    } finally {
      await worker.terminate();
    }
  }

  private async extractFromPdf(buffer: Buffer) {
    let pdf: any;
    let loadingTask: any;

    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

      loadingTask = pdfjs.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
      });

      pdf = await loadingTask.promise;
    } catch {
      throw new BadRequestException('Unable to read this PDF file.');
    }

    if (pdf.numPages > this.maxPdfPages) {
      await loadingTask.destroy();

      throw new BadRequestException(
        `PDF cannot contain more than ${this.maxPdfPages} pages.`,
      );
    }

    const pages: OcrPageResult[] = [];
    let worker: any = null;

    try {
      for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber++
      ) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();

        const nativeText = textContent.items
          .map((item: any) => item.str ?? '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (nativeText.length >= 20) {
          pages.push({
            page: pageNumber,
            text: nativeText,
            confidence: 100,
            method: 'TEXT',
          });

          page.cleanup();
          continue;
        }

        if (!worker) {
          worker = await this.createOcrWorker();
        }

        const viewport = page.getViewport({ scale: 1.5 });
        const width = Math.ceil(viewport.width);
        const height = Math.ceil(viewport.height);

        const canvas = createCanvas(width, height);
        const context = canvas.getContext('2d');

        await page.render({
          canvas: canvas as any,
          canvasContext: context as any,
          viewport,
        }).promise;

        const imageBuffer = canvas.toBuffer('image/png');
        const result = await worker.recognize(imageBuffer);

        pages.push({
          page: pageNumber,
          text: result.data.text.trim(),
          confidence: Math.round(result.data.confidence),
          method: 'OCR',
        });

        page.cleanup();
      }
    } finally {
      if (worker) {
        await worker.terminate();
      }

      await loadingTask.destroy();
    }

    return {
      success: true,
      language: 'eng+ben',
      totalPages: pages.length,
      text: pages
        .map((page) => page.text)
        .filter(Boolean)
        .join('\n\n'),
      pages,
    };
  }

  private parseQuestions(pages: OcrPageResult[]): ParsedQuestion[] {
    const questions: ParsedQuestion[] = [];

    for (const page of pages) {
      const lines = page.text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      let currentLines: string[] = [];

      const flush = () => {
        if (currentLines.length === 0) {
          return;
        }

        const rawText = currentLines.join('\n');

        const parsed = this.parseQuestionBlock(
          currentLines,
          page.page,
          rawText,
        );

        if (
          parsed.questionText ||
          Object.values(parsed.options).some(Boolean)
        ) {
          questions.push(parsed);
        }

        currentLines = [];
      };

      for (const line of lines) {
        if (this.isHeaderOrFooter(line)) {
          continue;
        }

        currentLines.push(line);

        // A question ends only when its answer marker is encountered.
        // Bengali digits such as ৪. or OCR characters such as 0.
        // inside an option can therefore never start another question.
        if (/^right\s*answer\s*:/i.test(line)) {
          flush();
        }
      }

      flush();
    }

    return questions;
  }

  private isHeaderOrFooter(line: string): boolean {
    const normalized = line.toLowerCase();

    return (
      normalized.startsWith('shikhasetu') ||
      line.startsWith('শিক্ষাসেতু') ||
      /^page\s+\d+\s+of\s+\d+/i.test(line)
    );
  }

  private parseQuestionBlock(
    lines: string[],
    sourcePage: number,
    rawText: string,
  ): ParsedQuestion {
    const options = {
      A: '',
      B: '',
      C: '',
      D: '',
    };

    const reviewReasons: string[] = [];

    let questionNumber: number | null = null;
    let questionText = '';
    let correctAnswer: 'A' | 'B' | 'C' | 'D' | null = null;
    let answerWasFound = false;
    let optionStarted = false;
    let lastOption: 'A' | 'B' | 'C' | 'D' | null = null;

    const firstLine = lines[0] ?? '';

    const numberMatch = firstLine.match(
      /^([0-9০-৯]{1,2})\s*[.)।-]\s*(.*)$/,
    );

    const unclearNumberMatch = firstLine.match(
      /^([©])\s*[.)।-]\s*(.*)$/,
    );

    if (numberMatch) {
      questionNumber = this.toNumber(numberMatch[1]);
      questionText = numberMatch[2].trim();
    } else if (unclearNumberMatch) {
      questionText = unclearNumberMatch[2].trim();
      reviewReasons.push('Question number may have been misread by OCR.');
    } else {
      questionText = firstLine;
      reviewReasons.push('Question number could not be identified.');
    }

    for (const originalLine of lines.slice(1)) {
      const line = originalLine.trim();

      const answerMatch = line.match(
        /^right\s*answer\s*:\s*(.*?)\s*$/i,
      );

      if (answerMatch) {
        answerWasFound = true;

        const answerToken = answerMatch[1]
          .trim()
          .toUpperCase()
          .replace(/[.]$/, '');

        if (/^[A-D]$/.test(answerToken)) {
          correctAnswer = answerToken as 'A' | 'B' | 'C' | 'D';
        } else {
          reviewReasons.push(
            `Unrecognized correct answer: "${answerMatch[1]}".`,
          );
        }

        continue;
      }

      const optionLine = this.parseOptionLine(line);

      if (optionLine) {
        optionStarted = true;

        let label: 'A' | 'B' | 'C' | 'D' | null = null;

        if (optionLine.ambiguous || !optionLine.label) {
          label = this.getNextAvailableOption(options);

          reviewReasons.push(
            'An option label may have been misread by OCR and was assigned by order.',
          );
        } else if (!options[optionLine.label]) {
          label = optionLine.label;
        } else {
          label = this.getNextAvailableOption(options);

          reviewReasons.push(
            `Option ${optionLine.label} was duplicated or misread.`,
          );
        }

        if (label && optionLine.text) {
          options[label] = optionLine.text;
          lastOption = label;
        } else {
          reviewReasons.push('An option could not be assigned reliably.');
        }

        continue;
      }

      if (!optionStarted) {
        questionText = questionText
          ? `${questionText} ${line}`
          : line;
      } else if (lastOption) {
        // A wrapped option continues the preceding option.
        options[lastOption] = `${options[lastOption]} ${line}`.trim();

        reviewReasons.push(
          `Option ${lastOption} contains a continuation line and needs checking.`,
        );
      } else {
        reviewReasons.push('Unrecognized text was found in the options.');
      }
    }

    const optionCount = Object.values(options).filter(Boolean).length;

    if (!questionText.trim()) {
      reviewReasons.push('Question text could not be identified.');
    }

    if (optionCount !== 4) {
      reviewReasons.push(
        `Expected 4 options, but identified ${optionCount}.`,
      );
    }

    if (!answerWasFound || !correctAnswer) {
      reviewReasons.push('Correct answer could not be identified reliably.');
    }

    if (correctAnswer && !options[correctAnswer]) {
      reviewReasons.push(
        `The identified correct answer ${correctAnswer} has no matching option.`,
      );
    }

    return {
      questionNumber,
      questionText: questionText.trim(),
      options,
      correctAnswer,
      sourcePage,
      reviewRequired: reviewReasons.length > 0,
      reviewReasons: [...new Set(reviewReasons)],
      rawText,
    };
  }

  private parseOptionLine(line: string): ParsedOptionLine | null {
    // Normal option labels with punctuation: A. Text, B) Text, C: Text
    const strictMatch = line.match(
      /^([A-Da-d])\s*[.)।:-]\s*(.*)$/,
    );

    if (strictMatch) {
      return {
        label: strictMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D',
        text: strictMatch[2].trim(),
        ambiguous: false,
      };
    }

    // Option labels where OCR removed punctuation: A Text
    const spacedMatch = line.match(/^([A-Da-d])\s+(.+)$/);

    if (spacedMatch) {
      return {
        label: spacedMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D',
        text: spacedMatch[2].trim(),
        ambiguous: false,
      };
    }

    // OCR may merge a label with its option text, e.g. "Aland6", "Cog", "AE".
    const mergedMatch = line.match(/^([A-Da-d])([A-Za-z0-9].*)$/);

    if (mergedMatch) {
      return {
        label: mergedMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D',
        text: mergedMatch[2].trim(),
        ambiguous: true,
      };
    }

    // Common OCR confusions for option labels.
    // Assign these by sequence, never by guessing their intended letter.
    const confusedMatch = line.match(
      /^([৪৮©0০])\s*[.)।,:-]\s*(.*)$/,
    );

    if (confusedMatch) {
      return {
        label: null,
        text: confusedMatch[2].trim(),
        ambiguous: true,
      };
    }

    const confusedSpacedMatch = line.match(
      /^([৪৮©0০])\s+(.+)$/,
    );

    if (confusedSpacedMatch) {
      return {
        label: null,
        text: confusedSpacedMatch[2].trim(),
        ambiguous: true,
      };
    }

    const confusedMergedMatch = line.match(
      /^([৪৮©0০])([^\s].*)$/,
    );

    if (confusedMergedMatch) {
      return {
        label: null,
        text: confusedMergedMatch[2].trim(),
        ambiguous: true,
      };
    }

    return null;
  }

  private getNextAvailableOption(
    options: {
      A: string;
      B: string;
      C: string;
      D: string;
    },
  ): 'A' | 'B' | 'C' | 'D' | null {
    const labels = ['A', 'B', 'C', 'D'] as const;

    return labels.find((label) => !options[label]) ?? null;
  }

  private toNumber(value: string): number | null {
    const normalized = value.replace(/[০-৯]/g, (digit) =>
      String('০১২৩৪৫৬৭৮৯'.indexOf(digit)),
    );

    const result = Number(normalized);

    return Number.isFinite(result) ? result : null;
  }
}
