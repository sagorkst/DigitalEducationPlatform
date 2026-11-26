const test = require('node:test');
const assert = require('node:assert/strict');
const { OccurrenceIdentityService } = require('../dist/modules/occurrences/occurrence-identity.service');

const base = {
  institution: 'Bangladesh Public Service Commission',
  institutionId: 'institution-001',
  examName: 'BCS Preliminary',
  postName: 'Assistant Director',
  postId: 'post-001',
};

function occurrence(year, overrides = {}) {
  return {
    id: \`occurrence-\${year}\`,
    ...base,
    examYear: year,
    examId: \`exam-\${year}\`,
    questionNumber: 10,
    ...overrides,
  };
}

test('same Year identity reuses an occurrence regardless of question number', () => {
  const result = OccurrenceIdentityService.classify(
    [occurrence(2020)],
    { ...base, examYear: 2020, examId: 'exam-2020', questionNumber: 99 },
  );
  assert.equal(result.kind, 'MATCH');
});

test('same Question in another Year creates a distinct occurrence', () => {
  const result = OccurrenceIdentityService.classify(
    [occurrence(2020)],
    { ...base, examYear: 2022, examId: 'exam-2022' },
  );
  assert.equal(result.kind, 'CREATE');
});

test('sole yearless legacy occurrence is enriched when a Year is supplied', () => {
  const existing = occurrence(null, { examId: null, examYear: null });
  const result = OccurrenceIdentityService.classify(
    [existing],
    { ...base, examYear: 2022, examId: 'exam-2022' },
  );
  assert.equal(result.kind, 'ENRICH');
  assert.equal(result.occurrence.id, existing.id);
});

test('missing Year reuses one unambiguous occurrence without clearing its stored Year', () => {
  const existing = occurrence(2020);
  const result = OccurrenceIdentityService.classify(
    [existing],
    { ...base, examYear: null, examId: null },
  );
  assert.equal(result.kind, 'MATCH');
  assert.equal(result.occurrence.examYear, 2020);
});

test('missing Year is ambiguous when multiple yearly occurrences share the same core identity', () => {
  const result = OccurrenceIdentityService.classify(
    [occurrence(2020), occurrence(2022)],
    { ...base, examYear: null, examId: null },
  );
  assert.equal(result.kind, 'AMBIGUOUS');
});

test('a missing Post is enriched when exactly one Exam/Year match exists', () => {
  const existing = occurrence(2020, { postName: null, postId: null });
  const result = OccurrenceIdentityService.classify(
    [existing],
    { ...base, examYear: 2020, examId: 'exam-2020' },
  );
  assert.equal(result.kind, 'ENRICH');
});
