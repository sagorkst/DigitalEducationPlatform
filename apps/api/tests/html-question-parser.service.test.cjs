const test = require('node:test');
const assert = require('node:assert/strict');

const {
  HtmlQuestionParserService,
} = require('../dist/modules/imports/html-question-parser.service');

function questionCard(id, questionText) {
  return `
    <div class="question-item" data-question-id="${id}" data-correct-option="A">
      <h2 class="question-text-el">${questionText}</h2>
      <span class="q-subject-pill">English</span>
      <span class="q-topic-pill">Grammar</span>
      <div class="option-item" data-option-label="A" data-is-correct="1">Option A</div>
      <div class="option-item" data-option-label="B" data-is-correct="0">Option B</div>
    </div>
  `;
}

test('HTML parser preserves all 200 source records when three have unreadable text', () => {
  const parser = new HtmlQuestionParserService();
  const html = Array.from({ length: 200 }, (_, index) =>
    questionCard(
      String(index + 1),
      index >= 197 ? '' : `Question number ${index + 1}?`,
    ),
  ).join('');

  const result = parser.parse(html, 'source.mhtml');

  assert.equal(result.totalCandidates, 200);
  assert.equal(result.extractedCount, 197);
  assert.equal(result.skippedCount, 3);
  assert.equal(result.questions.length, 200);
  assert.equal(result.questions[199].sourceQuestionId, '200');
  assert.equal(result.questions[199].questionText, '');
  assert.ok(
    result.questions[199].warnings.some((warning) =>
      warning.includes('retained for manual review'),
    ),
  );
});

test('HTML parser preserves repeated question text as separate source records', () => {
  const parser = new HtmlQuestionParserService();
  const html = [
    questionCard('1001', 'What is the capital of Bangladesh?'),
    questionCard('1002', 'What is the capital of Bangladesh?'),
  ].join('');

  const result = parser.parse(html, 'repeated-questions.html');

  assert.equal(result.totalCandidates, 2);
  assert.equal(result.extractedCount, 2);
  assert.equal(result.skippedCount, 0);
  assert.equal(result.questions.length, 2);
  assert.deepEqual(
    result.questions.map((question) => question.sourceQuestionId),
    ['1001', '1002'],
  );
});
