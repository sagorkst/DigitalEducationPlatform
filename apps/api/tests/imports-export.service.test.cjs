
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BadRequestException,
} = require('@nestjs/common');

const XLSX = require('xlsx');

const {
  ImportsExportService,
} = require('../dist/modules/imports/imports-export.service');

function createQuestion(overrides = {}) {
  return {
    id: 'question-1',
    questionCode: 'Q-001',
    questionText: 'What is the capital of Bangladesh?',
    imageReferences: ['/uploads/questions/question-diagram.webp'],
    questionType: 'MCQ',
    subject: 'Geography',
    topic: 'Capital',
    subjectId: 'subject-1',
    topicId: 'topic-1',
    correctAnswer: 'Dhaka',
    explanation: 'Dhaka is the capital of Bangladesh.',
    difficulty: 'EASY',
    status: 'VERIFIED',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    deletedAt: null,
    options: [
      {
        label: 'A',
        optionText: 'Dhaka',
        imageReferences: ['/uploads/questions/option-a.webp'],
        isCorrect: true,
        sortOrder: 1,
      },
      {
        label: 'B',
        optionText: 'Chattogram',
        imageReferences: [],
        isCorrect: false,
        sortOrder: 2,
      },
    ],
    occurrences: [
      {
        isPrimary: true,
        institution: 'PSC',
        examName: 'Primary Exam',
        examYear: 2024,
        postName: 'Assistant Teacher',
        department: 'Education',
        questionNumber: 10,
        source: 'Question Paper',
        sourcePage: 2,
        sourceUrl: 'https://example.com/source',
        institutionId: 'institution-1',
        examId: 'exam-1',
        postId: 'post-1',
        sourceDocumentId: 'document-1',
      },
    ],
    ...overrides,
  };
}

function createService(questions = []) {
  const prisma = {
    question: {
      findMany: async () => questions,
    },
  };

  return {
    service: new ImportsExportService(prisma),
    prisma,
  };
}

test('export rejects unsupported format', async () => {
  const { service } = createService();

  await assert.rejects(
    service.exportQuestions('pdf'),
    BadRequestException,
  );
});

test('export rejects empty format', async () => {
  const { service } = createService();

  await assert.rejects(
    service.exportQuestions(''),
    BadRequestException,
  );
});

test('export accepts uppercase JSON format', async () => {
  const { service } = createService();

  const result = await service.exportQuestions('JSON');

  assert.equal(
    result.fileName,
    'shikhasetu-questions.json',
  );
});

test('export accepts uppercase CSV format', async () => {
  const { service } = createService();

  const result = await service.exportQuestions('CSV');

  assert.equal(
    result.fileName,
    'shikhasetu-questions.csv',
  );
});

test('export accepts uppercase XLSX format', async () => {
  const { service } = createService();

  const result = await service.exportQuestions('XLSX');

  assert.equal(
    result.fileName,
    'shikhasetu-questions.xlsx',
  );
});

test('export queries only non-deleted questions', async () => {
  const { service, prisma } = createService();

  let query;

  prisma.question.findMany = async (args) => {
    query = args;
    return [];
  };

  await service.exportQuestions('json');

  assert.deepEqual(query.where, {
    deletedAt: null,
  });
});

test('export orders questions by createdAt descending', async () => {
  const { service, prisma } = createService();

  let query;

  prisma.question.findMany = async (args) => {
    query = args;
    return [];
  };

  await service.exportQuestions('json');

  assert.deepEqual(query.orderBy, {
    createdAt: 'desc',
  });
});

test('export includes options ordered by sortOrder ascending', async () => {
  const { service, prisma } = createService();

  let query;

  prisma.question.findMany = async (args) => {
    query = args;
    return [];
  };

  await service.exportQuestions('json');

  assert.deepEqual(
    query.include.options,
    {
      orderBy: {
        sortOrder: 'asc',
      },
    },
  );
});

test('export includes occurrences ordered by examYear descending', async () => {
  const { service, prisma } = createService();

  let query;

  prisma.question.findMany = async (args) => {
    query = args;
    return [];
  };

  await service.exportQuestions('json');

  assert.deepEqual(
    query.include.occurrences,
    {
      orderBy: {
        examYear: 'desc',
      },
    },
  );
});

test('JSON export returns correct filename and content type', async () => {
  const { service } = createService();

  const result = await service.exportQuestions('json');

  assert.equal(
    result.fileName,
    'shikhasetu-questions.json',
  );

  assert.equal(
    result.contentType,
    'application/json; charset=utf-8',
  );

  assert.ok(Buffer.isBuffer(result.buffer));
});

test('JSON export includes exportedAt and totalQuestions', async () => {
  const { service } = createService([
    createQuestion(),
  ]);

  const result = await service.exportQuestions('json');
  const data = JSON.parse(result.buffer.toString('utf8'));

  assert.ok(data.exportedAt);
  assert.equal(data.totalQuestions, 1);
});

test('JSON export includes question fields', async () => {
  const { service } = createService([
    createQuestion(),
  ]);

  const result = await service.exportQuestions('json');
  const data = JSON.parse(result.buffer.toString('utf8'));

  const question = data.questions[0];

  assert.equal(question.questionCode, 'Q-001');
  assert.equal(
    question.questionText,
    'What is the capital of Bangladesh?',
  );
  assert.equal(question.questionType, 'MCQ');
  assert.equal(question.subject, 'Geography');
  assert.equal(question.topic, 'Capital');
  assert.equal(question.subjectId, 'subject-1');
  assert.equal(question.topicId, 'topic-1');
  assert.equal(question.correctAnswer, 'Dhaka');
  assert.equal(question.status, 'VERIFIED');
  assert.deepEqual(question.imageReferences, ['/uploads/questions/question-diagram.webp']);
});

test('JSON export includes question options', async () => {
  const { service } = createService([
    createQuestion(),
  ]);

  const result = await service.exportQuestions('json');
  const data = JSON.parse(result.buffer.toString('utf8'));

  assert.deepEqual(
    data.questions[0].options,
    [
      {
        label: 'A',
        optionText: 'Dhaka',
        imageReferences: ['/uploads/questions/option-a.webp'],
        isCorrect: true,
        sortOrder: 1,
      },
      {
        label: 'B',
        optionText: 'Chattogram',
        imageReferences: [],
        isCorrect: false,
        sortOrder: 2,
      },
    ],
  );
});

test('JSON export includes occurrence data', async () => {
  const { service } = createService([
    createQuestion(),
  ]);

  const result = await service.exportQuestions('json');
  const data = JSON.parse(result.buffer.toString('utf8'));

  const occurrence = data.questions[0].occurrences[0];

  assert.equal(occurrence.institution, 'PSC');
  assert.equal(occurrence.examName, 'Primary Exam');
  assert.equal(occurrence.examYear, 2024);
  assert.equal(occurrence.questionNumber, 10);
  assert.equal(occurrence.examId, 'exam-1');
  assert.equal(occurrence.isPrimary, true);
});

test('JSON export handles empty questions', async () => {
  const { service } = createService([]);

  const result = await service.exportQuestions('json');
  const data = JSON.parse(result.buffer.toString('utf8'));

  assert.equal(data.totalQuestions, 0);
  assert.deepEqual(data.questions, []);
});

test('CSV export returns correct filename and content type', async () => {
  const { service } = createService([
    createQuestion(),
  ]);

  const result = await service.exportQuestions('csv');

  assert.equal(
    result.fileName,
    'shikhasetu-questions.csv',
  );

  assert.equal(
    result.contentType,
    'text/csv; charset=utf-8',
  );

  assert.ok(Buffer.isBuffer(result.buffer));
});

test('CSV export includes UTF-8 BOM', async () => {
  const { service } = createService([
    createQuestion(),
  ]);

  const result = await service.exportQuestions('csv');

  assert.equal(
    result.buffer.subarray(0, 3).toString('hex'),
    'efbbbf',
  );
});

test('CSV export includes question headers and data', async () => {
  const { service } = createService([
    createQuestion(),
  ]);

  const result = await service.exportQuestions('csv');
  const csv = result.buffer.toString('utf8');

  assert.ok(csv.includes('questionCode'));
  assert.ok(csv.includes('questionText'));
  assert.ok(csv.includes('correctAnswer'));
  assert.ok(csv.includes('Q-001'));
  assert.ok(csv.includes('Geography'));
});

test('CSV export serializes options and occurrences as JSON strings', async () => {
  const { service } = createService([
    createQuestion(),
  ]);

  const result = await service.exportQuestions('csv');
  const csv = result.buffer.toString('utf8');

  assert.ok(csv.includes('options'));
  assert.ok(csv.includes('occurrences'));
  assert.ok(csv.includes('Chattogram'));
  assert.ok(csv.includes('Primary Exam'));
});

test('CSV export handles empty questions', async () => {
  const { service } = createService([]);

  const result = await service.exportQuestions('csv');

  assert.ok(Buffer.isBuffer(result.buffer));
  assert.ok(result.buffer.length > 0);
});

test('XLSX export returns correct filename and content type', async () => {
  const { service } = createService([
    createQuestion(),
  ]);

  const result = await service.exportQuestions('xlsx');

  assert.equal(
    result.fileName,
    'shikhasetu-questions.xlsx',
  );

  assert.equal(
    result.contentType,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );

  assert.ok(Buffer.isBuffer(result.buffer));
});

test('XLSX export creates Questions worksheet', async () => {
  const { service } = createService([
    createQuestion(),
  ]);

  const result = await service.exportQuestions('xlsx');

  const workbook = XLSX.read(result.buffer, {
    type: 'buffer',
  });

  assert.ok(
    workbook.SheetNames.includes('Questions'),
  );
});

test('XLSX export includes question data', async () => {
  const { service } = createService([
    createQuestion(),
  ]);

  const result = await service.exportQuestions('xlsx');

  const workbook = XLSX.read(result.buffer, {
    type: 'buffer',
  });

  const worksheet = workbook.Sheets.Questions;

  const rows = XLSX.utils.sheet_to_json(worksheet);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].questionCode, 'Q-001');
  assert.equal(
    rows[0].questionText,
    'What is the capital of Bangladesh?',
  );
  assert.equal(rows[0].subject, 'Geography');
});

test('XLSX export serializes options and occurrences as JSON strings', async () => {
  const { service } = createService([
    createQuestion(),
  ]);

  const result = await service.exportQuestions('xlsx');

  const workbook = XLSX.read(result.buffer, {
    type: 'buffer',
  });

  const rows = XLSX.utils.sheet_to_json(
    workbook.Sheets.Questions,
  );

  const options = JSON.parse(rows[0].options);
  const occurrences = JSON.parse(rows[0].occurrences);

  assert.equal(options.length, 2);
  assert.equal(options[0].optionText, 'Dhaka');

  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].examName, 'Primary Exam');
});

test('XLSX export handles empty questions', async () => {
  const { service } = createService([]);

  const result = await service.exportQuestions('xlsx');

  const workbook = XLSX.read(result.buffer, {
    type: 'buffer',
  });

  assert.ok(
    workbook.SheetNames.includes('Questions'),
  );

  const rows = XLSX.utils.sheet_to_json(
    workbook.Sheets.Questions,
  );

  assert.equal(rows.length, 0);
});

test('export propagates Prisma database errors', async () => {
  const { service, prisma } = createService();

  prisma.question.findMany = async () => {
    throw new Error('Database connection failed');
  };

  await assert.rejects(
    service.exportQuestions('json'),
    /Database connection failed/,
  );
});
