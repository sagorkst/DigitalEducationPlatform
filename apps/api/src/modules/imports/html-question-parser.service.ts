import { Injectable } from '@nestjs/common';
import { load, CheerioAPI } from 'cheerio';

export type HtmlImportedQuestionType =
  | 'MCQ'
  | 'TRUE_FALSE'
  | 'WRITTEN';

export interface HtmlImportedOption {
  label: string;
  text: string;
  imageReferences: string[];
  isCorrect: boolean | null;
}

export interface HtmlImportedQuestion {
  questionText: string;
  questionType: HtmlImportedQuestionType;
  options: HtmlImportedOption[];
  correctAnswer: string | null;
  explanation: string | null;
  subject: string | null;
  topic: string | null;
  examName: string | null;
  institution: string | null;
  examYear: number | null;
  imageReferences: string[];
  sourceUrl: string | null;
  sourceQuestionId: string | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  warnings: string[];
}

export interface HtmlParseResult {
  sourceFileName: string;
  detectedStructure: string;
  totalCandidates: number;
  extractedCount: number;
  skippedCount: number;
  questions: HtmlImportedQuestion[];
  warnings: string[];
}

@Injectable()
export class HtmlQuestionParserService {
  private readonly questionSelectors = [
    '.question-item',
    '.question-card',
    '.question-container',
    '.question-block',
    '[data-question-id]',
    '[itemtype*="Question"]',
    'article.question',
    '.mcq-item',
    '.quiz-question',
  ];

  private readonly textSelectors = [
    '.question-text-content',
    '.question-text-el',
    '.question-text',
    '.question-title',
    '.question-content',
    '[itemprop="text"]',
    '.question',
  ];

  private readonly optionSelectors = [
    '.option-btn',
    '[data-option-label]',
    '.option-item',
    '.answer-option',
    '.question-option',
    '.mcq-option',
    '.options li',
    '.options label',
    '.option',
  ];

  private readonly explanationSelectors = [
    '.question-explanation-content',
    '.explanation-content',
    '.question-explanation',
    '.explanation',
    '.answer-explanation',
    '.solution',
    '[itemprop="acceptedAnswer"]',
  ];

  parse(
    html: string,
    sourceFileName = 'uploaded.html',
  ): HtmlParseResult {
    const warnings: string[] = [];

    if (!html || !html.trim()) {
      return {
        sourceFileName,
        detectedStructure: 'EMPTY',
        totalCandidates: 0,
        extractedCount: 0,
        skippedCount: 0,
        questions: [],
        warnings: ['HTML file is empty.'],
      };
    }

    const $ = load(html, {

    });

    const candidates = this.findQuestionContainers($);
    const questions: HtmlImportedQuestion[] = [];

    for (const element of candidates) {
      const container = $(element);
      const question = this.extractQuestion($, container);
      questions.push(question);
    }

    // Never discard a source record because its text repeats or extraction is incomplete.
    // Duplicate classification belongs to Import Preview, where every row remains reviewable.
    const extractedCount = questions.filter(
      (question) => question.questionText.trim().length >= 3 || question.imageReferences.length > 0,
    ).length;
    const skippedCount = Math.max(0, candidates.length - extractedCount);

    if (candidates.length === 0) {
      warnings.push(
        'No recognizable question containers were found. Custom selector mapping may be required.',
      );
    }

    if (skippedCount > 0) {
      warnings.push(
        `${skippedCount} question record(s) could not be extracted completely. All source records were retained for manual review.`,
      );
    }

    const hasBdniyog = $('.question-item').length > 0;

    return {
      sourceFileName,
      detectedStructure: hasBdniyog
        ? 'BDNIYOG_STYLE'
        : candidates.length > 0
          ? 'GENERIC_HTML'
          : 'UNKNOWN',
      totalCandidates: candidates.length,
      extractedCount,
      skippedCount,
      questions,
      warnings,
    };
  }

  private findQuestionContainers($: CheerioAPI): any[] {
    // Explicit source IDs and BDNiyog question cards are authoritative records.
    // Return them as-is so nested helper elements cannot reduce the source count.
    const explicit: any[] = [];
    const explicitSeen = new Set<any>();

    $('[data-question-id], .question-item').each((_, element) => {
      if (explicitSeen.has(element)) return;
      explicitSeen.add(element);
      explicit.push(element);
    });

    if (explicit.length > 0) return explicit;

    const found: any[] = [];
    const seen = new Set<any>();

    for (const selector of this.questionSelectors) {
      $(selector).each((_, element) => {
        if (seen.has(element)) return;

        const current = $(element);
        const text = this.normalize(current.text());
        const hasImage = current.find('img, [style*="background-image"]').length > 0;
        if (text.length < 5 && !hasImage) return;

        seen.add(element);
        found.push(element);
      });
    }

    if (found.length > 0) {
      const filtered = found.filter((element) => {
        const current = $(element);
        const parent = current.parent();

        return !parent.find(this.questionSelectors.join(', ')).toArray()
          .some((child) => child !== element);
      });

      return filtered.length > 0 ? filtered : found;
    }

    const fallbackSelectors = [
      '.question-text-content',
      '.question-text',
      '.question-title',
      '[itemprop="text"]',
    ];

    for (const selector of fallbackSelectors) {
      $(selector).each((_, element) => {
        let parent = $(element).parent();

        for (let depth = 0; depth < 4 && parent.length; depth++) {
          const candidate = parent.get(0);

          if (
            candidate &&
            !seen.has(candidate) &&
            this.normalize(parent.text()).length >= 10
          ) {
            seen.add(candidate);
            found.push(candidate);
            break;
          }

          parent = parent.parent();
        }
      });
    }

    return found;
  }

  private extractQuestion(
    $: CheerioAPI,
    container: any,
  ): HtmlImportedQuestion {
    const questionText = this.extractQuestionText($, container);
    const options = this.extractOptions($, container);
    const containerCorrect = this.firstAttribute(
      container,
      ['data-correct-option', 'data-answer', 'data-correct-answer'],
    );

    let correctAnswer: string | null =
      options.find((option) => option.isCorrect === true)?.label ?? null;

    if (!correctAnswer && containerCorrect) {
      correctAnswer = this.normalize(containerCorrect);
    }

    const explicitCorrect = options.some(
      (option) => option.isCorrect === true,
    );

    const explanation = this.extractBySelectors(
      $,
      container,
      this.explanationSelectors,
    );

    const subject = this.extractBySelectors($, container, [
      '.q-subject-pill',
      '.subject-name',
      '.question-subject',
      '[data-subject]',
      '[itemprop="about"]',
    ]);

    const topic = this.extractBySelectors($, container, [
      '.q-topic-pill',
      '.topic-name',
      '.question-topic',
      '[data-topic]',
    ]);

    const examReference = this.extractBySelectors($, container, [
      '.q-exam-ref',
      '.exam-name',
      '.exam-reference',
      '.question-exam',
    ]);

    const examMetadata = this.extractExamMetadata(examReference);
    const examName = examMetadata.examName;
    const institution = examMetadata.institution;
    const examYear = examMetadata.examYear;

    const imageContainer = container.clone();
    imageContainer.find(this.optionSelectors.join(', ')).remove();
    const imageReferences = this.extractImages($, imageContainer);

    const warnings: string[] = [];

    if (questionText.trim().length < 3 && imageReferences.length === 0) {
      warnings.push(
        'Question text could not be extracted. This source record was retained for manual review.',
      );
    }

    if (options.length > 0 && !explicitCorrect && !containerCorrect) {
      warnings.push('Correct answer was not explicitly identified.');
    }

    if (options.length === 1) {
      warnings.push('Only one option was detected.');
    }

    if (!explanation) {
      warnings.push('Explanation was not found.');
    }

    const isTrueFalse =
      options.length === 2 &&
      options.some((o) => /^(true|false|সত্য|মিথ্যা)$/i.test(o.text));

    const questionType: HtmlImportedQuestionType =
      options.length >= 2
        ? isTrueFalse
          ? 'TRUE_FALSE'
          : 'MCQ'
        : 'WRITTEN';

    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';

    if ((questionText || imageReferences.length > 0) && options.length >= 2) {
      confidence = explicitCorrect
        ? 'HIGH'
        : containerCorrect
          ? 'MEDIUM'
          : 'LOW';
    } else if (questionText || imageReferences.length > 0) {
      confidence = 'MEDIUM';
    }

    return {
      questionText,
      questionType,
      options,
      correctAnswer,
      explanation,
      subject,
      topic,
      examName,
      institution,
      examYear,
      imageReferences,
      sourceUrl: null,
      sourceQuestionId:
        this.firstAttribute(container, ['data-question-id', 'id']) || null,
      confidence,
      warnings,
    };
  }

  private extractQuestionText($: CheerioAPI, container: any): string {
    for (const selector of this.textSelectors) {
      const element = container.find(selector).first();

      if (!element.length) continue;

      const text = this.cleanElement($, element);

      if (text.length >= 3) return text;
    }

    const clone = container.clone();

    clone.find([
      ...this.optionSelectors,
      ...this.explanationSelectors,
      '.q-subject-pill',
      '.q-topic-pill',
      '.q-exam-ref',
      '.exam-name',
      '.exam-reference',
      '.question-exam',
      '.exam',
      '.metadata',
      '.question-meta',
      'button',
      'script',
      'style',
      'svg',
      'nav',
    ].join(', ')).remove();

    return this.normalize(clone.text());
  }

  private extractOptions(
    $: CheerioAPI,
    container: any,
  ): HtmlImportedOption[] {
    const result: HtmlImportedOption[] = [];
    const seen = new Set<string>();
    const selectors = this.optionSelectors.join(', ');

    container.find(selectors).each((_index: number, element: any) => {
      const option = $(element);

      if (option.find(selectors).length > 0) return;

      const textElement = option.find(
        '.option-text, .option-content, .answer-text',
      ).first();

      const text = textElement.length
        ? this.cleanElement($, textElement)
        : this.cleanElement($, option);

      const imageReferences = this.extractImages($, option);
      if ((!text && imageReferences.length === 0) || text.length > 3000) return;

      const label =
        this.firstAttribute(option, [
          'data-option-label',
          'data-label',
          'data-key',
        ]) ||
        this.extractOptionLabel(option.text()) ||
        String.fromCharCode(65 + result.length);

      const fingerprint = `${label}:${text}`.toLowerCase();

      if (seen.has(fingerprint)) return;
      seen.add(fingerprint);

      const correctAttribute = this.firstAttribute(option, [
        'data-is-correct',
        'data-correct',
        'aria-correct',
      ]);

      const className = String(option.attr('class') || '');
      let isCorrect: boolean | null = null;

      if (
        correctAttribute === '1' ||
        correctAttribute === 'true' ||
        correctAttribute === 'yes'
      ) {
        isCorrect = true;
      } else if (
        correctAttribute === '0' ||
        correctAttribute === 'false' ||
        correctAttribute === 'no'
      ) {
        isCorrect = false;
      } else if (/\bcorrect-option\b|\bopt-correct\b/i.test(className)) {
        isCorrect = true;
      }

      result.push({
        label: this.normalize(label),
        text,
        imageReferences,
        isCorrect,
      });
    });

    return result;
  }

  private extractBySelectors(
    $: CheerioAPI,
    container: any,
    selectors: string[],
  ): string | null {
    for (const selector of selectors) {
      const element = container.find(selector).first();

      if (!element.length) continue;

      const value = this.cleanElement($, element);

      if (value) return value;
    }

    return null;
  }

  private extractImages($: CheerioAPI, container: any): string[] {
    const images = new Set<string>();
    const add = (value: string | undefined) => {
      const source = String(value ?? '').trim();
      if (!source || /^javascript:/i.test(source)) return;
      if (/^data:image\//i.test(source) && source.length > 2_000_000) return;
      images.add(source);
    };

    container.find('img').each((_index: number, element: any) => {
      const image = $(element);
      for (const attribute of ['src', 'data-src', 'data-lazy-src', 'data-original', 'data-original-src', 'data-image']) {
        add(image.attr(attribute));
      }
      const srcset = image.attr('srcset') || image.attr('data-srcset');
      if (srcset) {
        for (const candidate of srcset.split(',')) {
          add(candidate.trim().split(/\s+/)[0]);
        }
      }
    });

    container.find('[style*="background-image"]').each((_index: number, element: any) => {
      const style = String($(element).attr('style') ?? '');
      for (const match of style.matchAll(/url\((?:['"])?(.*?)(?:['"])?\)/gi)) {
        add(match[1]);
      }
    });

    return Array.from(images);
  }

  private extractExamMetadata(value: string | null): {
    examName: string | null;
    institution: string | null;
    examYear: number | null;
  } {
    if (!value) {
      return {
        examName: null,
        institution: null,
        examYear: null,
      };
    }

    const normalizedDigits = value.replace(/[০-৯]/g, (digit) =>
      String('০১২৩৪৫৬৭৮৯'.indexOf(digit)),
    );

    const reference = normalizedDigits
      .replace(/^\s*\[/, '')
      .replace(/\]\s*$/, '')
      .trim();

    const year = this.extractYear(reference);
    const yearAtEnd = reference.match(/\b((?:19|20)\d{2})\s*$/);

    if (year !== null && yearAtEnd) {
      const withoutYear = reference
        .slice(0, yearAtEnd.index)
        .trim();

      const separatorIndex = withoutYear.lastIndexOf(' - ');

      if (separatorIndex > 0) {
        const examName = withoutYear
          .slice(0, separatorIndex)
          .trim();

        const institution = withoutYear
          .slice(separatorIndex + 3)
          .trim();

        if (examName && institution) {
          return {
            examName,
            institution,
            examYear: year,
          };
        }
      }
    }

    return {
      examName: reference || null,
      institution: null,
      examYear: year,
    };
  }
  private extractYear(value: string | null): number | null {
    if (!value) return null;

    const englishDigits = value.replace(/[০-৯]/g, (digit) =>
      String('০১২৩৪৫৬৭৮৯'.indexOf(digit)),
    );

    const match = englishDigits.match(/(?:19|20)\d{2}/);

    if (!match) return null;

    const year = Number(match[0]);

    return year >= 1900 && year <= 2100 ? year : null;
  }

  private extractOptionLabel(value: string): string | null {
    const normalized = this.normalize(value);

    const match = normalized.match(
      /^([A-Da-dকখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহ০-৯১-৪])[\s.।):\-]+/,
    );

    return match?.[1] ?? null;
  }

  private firstAttribute(element: any, names: string[]): string | null {
    for (const name of names) {
      const value = element.attr(name);

      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return null;
  }

  private cleanElement($: CheerioAPI, element: any): string {
    const clone = element.clone();

    clone.find([
      'script',
      'style',
      'svg',
      'button',
      '.correct-check-icon',
      '.share-btn',
      '.bookmark-btn',
      '.q-exam-ref',
      '.exam-name',
      '.exam-reference',
      '.question-exam',
      '.question-meta',
      '.metadata',
    ].join(', ')).remove();

    return this.normalize(clone.text());
  }

  private normalize(value: string): string {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[\t\r\n]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
}
