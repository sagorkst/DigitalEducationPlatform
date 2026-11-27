import { Injectable } from '@nestjs/common';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { readFile } from 'fs/promises';
import { basename, resolve, sep } from 'path';

export type ImageStandardizationResult = {
  source: string;
  kind: 'TEXT_ONLY' | 'VISUAL_OR_UNCERTAIN' | 'UNAVAILABLE' | 'UNSUPPORTED';
  status: 'REPLACED' | 'KEPT' | 'REVIEW';
  extractedText: string;
  confidence: number;
  reason: string;
};

type LocalImage = { path: string; source: string };

@Injectable()
export class ImportImageStandardizationService {
  private readonly maxImagesPerBatch = 500;
  private readonly maxImageBytes = 12 *  1024 * 1024;

  private resolveLocalImage(source: string): LocalImage | null {
    try {
      const apiOrigin = new URL(process.env.API_BASE_URL ?? 'http://localhost:4000/api').origin;
      const url = new URL(source, apiOrigin);
      if (url.origin !== apiOrigin) return null;
      const match = url.pathname.match(/^\/uploads\/questions\/([a-f0-9-]{36})\.webp$/i);
      if (!match) return null;
      const filePath = resolve(process.cwd(), 'uploads', 'questions', basename(match[1] + '.webp'));
      const allowedRoot = resolve(process.cwd(), 'uploads', 'questions') + sep;
      if (!filePath.startsWith(allowedRoot)) return null;
      return { path: filePath, source };
    } catch {
      return null;
    }
  }

  async analyzeReferences(references: string[]): Promise<ImageStandardizationResult[]> {
    const unique = [...new Set((references ?? []).filter((value) => typeof value === 'string' && value.trim()))];
    if (unique.length === 0) return [];

    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
    const results: ImageStandardizationResult[] = [];

    try {
      for (const source of unique.slice(0, this.maxImagesPerBatch)) {
        const local = this.resolveLocalImage(source);
        if (!local) {
          results.push({
            source, kind: 'UNAVAILABLE', status: 'KEPT', extractedText: '',
            confidence: 0, reason: 'Image is external or is not a managed local upload; original retained.',
          });
          continue;
        }

        try {
          const buffer = await readFile(local.path);
          if (buffer.length === 0 || buffer.length > this.maxImageBytes) {
            results.push({
              source, kind: 'UNSUPPORTED', status: 'KEPT', extractedText: '',
              confidence: 0, reason: 'Image is empty or exceeds the safe OCR size limit; original retained.',
            });
            continue;
          }

          const metadata = await sharp(buffer, { limitInputPixels: 40_000_000, failOn: 'error' }).metadata();
          if (!metadata.width || !metadata.height || metadata.width < 80 || metadata.height < 40) {
            results.push({
              source, kind: 'UNSUPPORTED', status: 'KEPT', extractedText: '',
              confidence: 0, reason: 'Image dimensions are too small for reliable text extraction; original retained.',
            });
            continue;
          }

          worker ??= await createWorker('eng+ben');
          const ocr = await worker.recognize(buffer);
          const data = ocr.data as any;
          const extractedText = String(data.text ?? '')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
          const confidence = Math.max(0, Math.min(100, Math.round(Number(data.confidence) || 0)));
          const words = Array.isArray(data.words) ? data.words : [];
          const wordArea = words.reduce((sum: number, word: any) => {
            const box = word?.bbox;
            if (!box) return sum;
            const width = Math.max(0, Number(box.x1) - Number(box.x0));
            const height = Math.max(0, Number(box.y1) - Number(box.y0));
            return sum + width * height;
          }, 0);
          const imageArea = metadata.width * metadata.height;
          const textCoverage = Math.min(1, wordArea / imageArea);
          const wordCount = words.filter((word: any) => String(word?.text ?? '').trim()).length;
          const compactLength = extractedText.replace(/\s/g, '').length;

          // A text-only image can be replaced at a lower, still conservative threshold.
          // OCR from mixed/uncertain images is also retained as editable text, but the
          // original image stays attached so diagrams, charts and formulas are not lost.
          const textOnly =
            confidence >= 88 &&
            compactLength >= 20 &&
            wordCount >= 4 &&
            textCoverage >= 0.12;
          const usableOcrText =
            confidence >= 55 &&
            compactLength >= 6 &&
            wordCount >= 2;

          results.push({
            source,
            kind: textOnly ? 'TEXT_ONLY' : 'VISUAL_OR_UNCERTAIN',
            status: textOnly ? 'REVIEW' : 'KEPT',
            extractedText: usableOcrText ? extractedText : '',
            confidence,
            reason: textOnly
              ? 'Text-dense image detected; OCR text can replace the image.'
              : usableOcrText
                ? 'Readable text was extracted, but the original image is retained because it may also contain a diagram, formula or chart.'
                : 'No sufficiently reliable text was detected. Original image retained.',
          });
        } catch {
          results.push({
            source, kind: 'UNSUPPORTED', status: 'KEPT', extractedText: '',
            confidence: 0, reason: 'Image could not be decoded or OCR failed; original retained.',
          });
        }
      }

      for (const source of unique.slice(this.maxImagesPerBatch)) {
        results.push({
          source, kind: 'UNSUPPORTED', status: 'KEPT', extractedText: '',
          confidence: 0, reason: 'Per-batch OCR limit reached; original retained for a later processing pass.',
        });
      }
    } finally {
      if (worker) await worker.terminate();
    }

    return results;
  }

  applySafeTextReplacement(
    text: string,
    references: string[],
    analyses: ImageStandardizationResult[],
  ): { text: string; imageReferences: string[]; replacements: ImageStandardizationResult[] } {
    let outputText = String(text ?? '').trim();
    const bySource = new Map(analyses.map((item) => [item.source, item]));
    const replacements: ImageStandardizationResult[] = [];
    const retained: string[] = [];

    const appendIfNew = (candidate: string) => {
      const value = candidate.trim();
      if (!value) return;
      const normalize = (input: string) => input.toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
      const normalizedValue = normalize(value);
      const normalizedCurrent = normalize(outputText);
      if (!normalizedValue || normalizedCurrent.includes(normalizedValue)) return;
      outputText = outputText ? `${outputText}\n${value}` : value;
    };

    for (const source of references ?? []) {
      const analysis = bySource.get(source);
      if (!analysis) {
        retained.push(source);
        continue;
      }

      if (analysis.extractedText.trim() && analysis.confidence >= 55) {
        appendIfNew(analysis.extractedText);
      }

      if (
        analysis.kind === 'TEXT_ONLY' &&
        analysis.confidence >= 88 &&
        analysis.extractedText.trim()
      ) {
        replacements.push({ ...analysis, status: 'REPLACED' });
        continue;
      }

      // Mixed/uncertain images contribute OCR text but remain attached.
      retained.push(source);
    }

    return { text: outputText, imageReferences: retained, replacements };
  }
}
