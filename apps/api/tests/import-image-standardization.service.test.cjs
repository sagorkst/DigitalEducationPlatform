const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ImportImageStandardizationService,
} = require('../dist/modules/imports/import-image-standardization.service');

test('high-confidence text-only images are converted to text automatically', () => {
  const service = new ImportImageStandardizationService();
  const source = 'https://api.example.test/uploads/questions/123e4567-e89b-12d3-a456-426614174000.webp';
  const result = service.applySafeTextReplacement('', [source], [{
    source,
    kind: 'TEXT_ONLY',
    status: 'REVIEW',
    extractedText: 'প্রশ্নের লেখা OCR থেকে পাওয়া গেছে',
    confidence: 90,
    reason: 'Text-only image.',
  }]);

  assert.equal(result.text, 'প্রশ্নের লেখা OCR থেকে পাওয়া গেছে');
  assert.deepEqual(result.imageReferences, []);
  assert.equal(result.replacements.length, 1);
  assert.equal(result.replacements[0].status, 'REPLACED');
});

test('multiple text-only images are combined while visual images stay attached', () => {
  const service = new ImportImageStandardizationService();
  const textA = 'https://api.example.test/uploads/questions/123e4567-e89b-12d3-a456-426614174010.webp';
  const diagram = 'https://api.example.test/uploads/questions/123e4567-e89b-12d3-a456-426614174011.webp';
  const textB = 'https://api.example.test/uploads/questions/123e4567-e89b-12d3-a456-426614174012.webp';
  const result = service.applySafeTextReplacement('', [textA, diagram, textB], [
    { source: textA, kind: 'TEXT_ONLY', status: 'REVIEW', extractedText: 'প্রথম অংশ', confidence: 98, reason: 'Text-only.' },
    { source: diagram, kind: 'VISUAL_OR_UNCERTAIN', status: 'KEPT', extractedText: '', confidence: 60, reason: 'Diagram retained.' },
    { source: textB, kind: 'TEXT_ONLY', status: 'REVIEW', extractedText: 'দ্বিতীয় অংশ', confidence: 90, reason: 'Text-only.' },
  ]);
  assert.equal(result.text, 'প্রথম অংশ\nদ্বিতীয় অংশ');
  assert.deepEqual(result.imageReferences, [diagram]);
  assert.equal(result.replacements.length, 2);
});

test('mixed images add readable OCR text while retaining the original visual', () => {
  const service = new ImportImageStandardizationService();
  const source = 'https://api.example.test/uploads/questions/123e4567-e89b-12d3-a456-426614174001.webp';
  const result = service.applySafeTextReplacement('প্রশ্ন: নিচের চিত্রটি দেখুন', [source], [{
    source,
    kind: 'VISUAL_OR_UNCERTAIN',
    status: 'KEPT',
    extractedText: 'চিত্রে A বিন্দু থেকে B বিন্দুর দূরত্ব',
    confidence: 72,
    reason: 'Text extracted; visual retained.',
  }]);

  assert.equal(result.text, 'প্রশ্ন: নিচের চিত্রটি দেখুন\nচিত্রে A বিন্দু থেকে B বিন্দুর দূরত্ব');
  assert.deepEqual(result.imageReferences, [source]);
  assert.equal(result.replacements.length, 0);
});

test('unreliable OCR is not added and keeps its source image', () => {
  const service = new ImportImageStandardizationService();
  const source = 'https://api.example.test/uploads/questions/123e4567-e89b-12d3-a456-426614174003.webp';
  const result = service.applySafeTextReplacement('', [source], [{
    source,
    kind: 'VISUAL_OR_UNCERTAIN',
    status: 'KEPT',
    extractedText: '',
    confidence: 40,
    reason: 'Below safe OCR threshold.',
  }]);

  assert.equal(result.text, '');
  assert.deepEqual(result.imageReferences, [source]);
  assert.equal(result.replacements.length, 0);
});

test('existing matching text is not duplicated and a text-only image is replaced', () => {
  const service = new ImportImageStandardizationService();
  const source = 'https://api.example.test/uploads/questions/123e4567-e89b-12d3-a456-426614174002.webp';
  const existingText = 'প্রশ্নের লেখা আগে থেকেই আছে';
  const result = service.applySafeTextReplacement(existingText, [source], [{
    source,
    kind: 'TEXT_ONLY',
    status: 'REVIEW',
    extractedText: existingText,
    confidence: 99,
    reason: 'Text-dense image detected.',
  }]);

  assert.equal(result.text, existingText);
  assert.deepEqual(result.imageReferences, []);
  assert.equal(result.replacements.length, 1);
});
