const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ImportImageStandardizationService,
} = require('../dist/modules/imports/import-image-standardization.service');

test('OCR suggestions never remove the original image before explicit review', () => {
  const service = new ImportImageStandardizationService();
  const source = 'https://api.example.test/uploads/questions/123e4567-e89b-12d3-a456-426614174000.webp';
  const result = service.applySafeTextReplacement('', [source], [{
    source,
    kind: 'TEXT_ONLY',
    status: 'REVIEW',
    extractedText: 'প্রশ্নের লেখা OCR থেকে পাওয়া গেছে',
    confidence: 97,
    reason: 'Text-dense image detected.',
  }]);

  assert.equal(result.text, '');
  assert.deepEqual(result.imageReferences, [source]);
  assert.equal(result.replacements.length, 1);
  assert.equal(result.replacements[0].extractedText, 'প্রশ্নের লেখা OCR থেকে পাওয়া গেছে');
  assert.equal(result.replacements[0].status, 'REVIEW');
});

test('images containing diagrams or mixed content are retained without OCR replacement', () => {
  const service = new ImportImageStandardizationService();
  const source = 'https://api.example.test/uploads/questions/123e4567-e89b-12d3-a456-426614174001.webp';
  const result = service.applySafeTextReplacement('', [source], [{
    source,
    kind: 'VISUAL_OR_UNCERTAIN',
    status: 'KEPT',
    extractedText: '',
    confidence: 63,
    reason: 'Possible diagram or mixed visual content.',
  }]);

  assert.equal(result.text, '');
  assert.deepEqual(result.imageReferences, [source]);
  assert.equal(result.replacements.length, 0);
});

test('existing text and its supporting image are not destructively rewritten', () => {
  const service = new ImportImageStandardizationService();
  const source = 'https://api.example.test/uploads/questions/123e4567-e89b-12d3-a456-426614174002.webp';
  const result = service.applySafeTextReplacement('প্রশ্নের লেখা আগে থেকেই আছে', [source], [{
    source,
    kind: 'TEXT_ONLY',
    status: 'REVIEW',
    extractedText: 'অন্য OCR লেখা',
    confidence: 99,
    reason: 'Text-dense image detected.',
  }]);

  assert.equal(result.text, 'প্রশ্নের লেখা আগে থেকেই আছে');
  assert.deepEqual(result.imageReferences, [source]);
  assert.equal(result.replacements.length, 0);
});
