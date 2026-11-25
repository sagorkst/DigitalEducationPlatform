const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BadRequestException,
  NotFoundException,
} = require('@nestjs/common');

const { Prisma } = require('../dist/generated/prisma/client');
const {
  ImportsService,
} = require('../dist/modules/imports/imports.service');

const BATCH_ID = 'batch-001';

function validRow(overrides = {}) {
  return {
    questionText: 'What is the capital of Bangladesh?',
    subject: 'General Knowledge',
    topic: 'Geography',
    questionType: 'MCQ',
    difficulty: 'MEDIUM',
    status: 'DRAFT',
    options: [
      { label: 'A', optionText: 'Dhaka', isCorrect: true },
      { label: 'B', optionText: 'Khulna', isCorrect: false },
      { label: 'C', optionText: 'Rajshahi', isCorrect: false },
      { label: 'D', optionText: 'Sylhet', isCorrect: false },
    ],
    occurrences: [
      {
        institution: 'PSC',
        examName: 'BCS Preliminary',
        examYear: 2025,
      },
    ],
    ...overrides,
  };
}

function jsonFile(rows, name = 'questions.json') {
  return {
    originalname: name,
    buffer: Buffer.from(JSON.stringify(rows)),
    size: Buffer.byteLength(JSON.stringify(rows)),
  };
}

function createPrisma(overrides = {}) {
  const prisma = {
    importBatch: {
      create: async () => ({ id: BATCH_ID }),
      update: async () => ({ id: BATCH_ID }),
      updateMany: async () => ({ count: 1 }),
      findMany: async () => [],
      findUnique: async () => ({ id: BATCH_ID }),
      findUniqueOrThrow: async () => ({ id: BATCH_ID }),
      count: async () => 0,
      ...overrides.importBatch,
    },

    importRow: {
      createMany: async () => ({ count: 1 }),
      findMany: async () => [],
      count: async () => 0,
      update: async () => ({}),
      updateMany: async () => ({ count: 1 }),
      ...overrides.importRow,
    },

    question: {
      findFirst: async () => null,
      create: async () => ({ id: 'question-001' }),
      ...overrides.question,
    },

    exam: {
      findUnique: async () => null,
      ...overrides.exam,
    },

    subject: {
      findFirst: async () => null,
      ...overrides.subject,
    },

    topic: {
      findFirst: async () => null,
      ...overrides.topic,
    },
  };

  prisma.$transaction = async (operation) => {
    if (typeof operation === 'function') {
      return operation(prisma);
    }

    return Promise.all(operation);
  };

  return prisma;
}

function createService(overrides = {}) {
  const prisma = createPrisma(overrides);
  return {
    prisma,
    service: new ImportsService(prisma),
  };
}

// =====================================================
// FILE VALIDATION AND PARSING
// =====================================================

test('01 - rejects missing uploaded file', async () => {
  const { service } = createService();

  await assert.rejects(
    service.preview(undefined),
    BadRequestException,
  );
});

test('02 - rejects empty uploaded file', async () => {
  const { service } = createService();

  await assert.rejects(
    service.preview({
      originalname: 'questions.json',
      buffer: Buffer.alloc(0),
      size: 0,
    }),
    BadRequestException,
  );
});

test('03 - rejects unsupported file extension', async () => {
  const { service } = createService();

  await assert.rejects(
    service.preview({
      originalname: 'questions.txt',
      buffer: Buffer.from('test'),
      size: 4,
    }),
    BadRequestException,
  );
});

test('04 - rejects malformed JSON', async () => {
  const { service } = createService();

  await assert.rejects(
    service.preview({
      originalname: 'questions.json',
      buffer: Buffer.from('{invalid json'),
      size: 13,
    }),
    BadRequestException,
  );
});

test('05 - rejects empty JSON array', async () => {
  const { service } = createService();

  await assert.rejects(
    service.preview(jsonFile([])),
    BadRequestException,
  );
});

test('06 - accepts JSON array and creates import preview', async () => {
  const { service, prisma } = createService();

  let savedRows;
  let batchUpdate;

  prisma.importRow.createMany = async ({ data }) => {
    savedRows = data;
    return { count: data.length };
  };

  prisma.importBatch.update = async ({ data }) => {
    batchUpdate = data;
    return { id: BATCH_ID, ...data };
  };

  const result = await service.preview(
    jsonFile([validRow()]),
  );

  assert.equal(result.success, true);
  assert.equal(result.data.summary.totalRows, 1);
  assert.equal(result.data.summary.validRows, 1);
  assert.equal(result.data.summary.invalidRows, 0);
  assert.equal(result.data.summary.duplicateRows, 0);

  assert.equal(savedRows.length, 1);
  assert.equal(savedRows[0].rowNumber, 1);
  assert.equal(savedRows[0].status, 'VALID');
  assert.equal(batchUpdate.status, 'REVIEW');
});

test('07 - accepts JSON object containing questions array', async () => {
  const { service } = createService();

  const file = jsonFile({
    questions: [validRow()],
  });

  const result = await service.preview(file);

  assert.equal(result.success, true);
  assert.equal(result.data.summary.totalRows, 1);
});

test('08 - rejects non-object row data', async () => {
  const { service } = createService();

  await assert.rejects(
    service.preview(jsonFile(['invalid row'])),
    BadRequestException,
  );
});

test('09 - rejects rows with missing required fields', async () => {
  const { service, prisma } = createService();

  let savedRows;

  prisma.importRow.createMany = async ({ data }) => {
    savedRows = data;
    return { count: data.length };
  };

  const result = await service.preview(
    jsonFile([{ questionText: '' }]),
  );

  assert.equal(result.data.summary.invalidRows, 1);
  assert.equal(result.data.summary.validRows, 0);
  assert.equal(savedRows[0].status, 'INVALID');

  assert.ok(
    savedRows[0].errorMessages.includes(
      'Question text is required.',
    ),
  );
});

test('10 - accepts MCQ without options', async () => {
  const { service, prisma } = createService();

  let savedRows;

  prisma.importRow.createMany = async ({ data }) => {
    savedRows = data;
    return { count: data.length };
  };

  const row = validRow({ options: undefined });

  const result = await service.preview(jsonFile([row]));

  assert.equal(result.data.summary.invalidRows, 0);
  assert.equal(result.data.summary.validRows, 1);
  assert.equal(savedRows[0].status, 'VALID');
});

test('11 - accepts MCQ with multiple correct options', async () => {
  const { service, prisma } = createService();

  let savedRows;
  prisma.importRow.createMany = async ({ data }) => {
    savedRows = data;
    return { count: data.length };
  };

  const row = validRow({
    options: [
      { label: 'A', optionText: 'Option A', isCorrect: true },
      { label: 'B', optionText: 'Option B', isCorrect: true },
    ],
  });

  await service.preview(jsonFile([row]));
  assert.equal(savedRows[0].status, 'VALID');
});

test('11b - accepts MCQ with no correct option selected', async () => {
  const { service, prisma } = createService();

  let savedRows;
  prisma.importRow.createMany = async ({ data }) => {
    savedRows = data;
    return { count: data.length };
  };

  const row = validRow({
    options: [
      { label: 'A', optionText: 'Option A', isCorrect: false },
      { label: 'B', optionText: 'Option B', isCorrect: false },
    ],
    correctAnswer: undefined,
  });

  await service.preview(jsonFile([row]));
  assert.equal(savedRows[0].status, 'VALID');
});

test('11c - rejects MCQ with more than four options', async () => {
  const { service, prisma } = createService();

  let savedRows;
  prisma.importRow.createMany = async ({ data }) => {
    savedRows = data;
    return { count: data.length };
  };

  const row = validRow({
    options: ['A', 'B', 'C', 'D', 'E'].map((label) => ({
      label,
      optionText: `Option ${label}`,
      isCorrect: false,
    })),
  });

  await service.preview(jsonFile([row]));
  assert.equal(savedRows[0].status, 'INVALID');
  assert.ok(savedRows[0].errorMessages.includes('A maximum of 4 options is allowed.'));
});

test('12 - detects duplicate questions inside the same import file', async () => {
  const { service, prisma } = createService();

  let savedRows;

  prisma.importRow.createMany = async ({ data }) => {
    savedRows = data;
    return { count: data.length };
  };

  const first = validRow();
  const second = validRow({
    questionText: 'WHAT IS THE CAPITAL OF BANGLADESH?',
  });

  const result = await service.preview(
    jsonFile([first, second]),
  );

  assert.equal(result.data.summary.validRows, 1);
  assert.equal(result.data.summary.duplicateRows, 1);

  assert.equal(savedRows[0].status, 'VALID');
  assert.equal(savedRows[1].status, 'DUPLICATE');
});

test('13 - detects question already present in question bank', async () => {
  const { service, prisma } = createService();

  prisma.question.findFirst = async () => ({
    id: 'existing-question',
  });

  let savedRows;

  prisma.importRow.createMany = async ({ data }) => {
    savedRows = data;
    return { count: data.length };
  };

  const result = await service.preview(
    jsonFile([validRow()]),
  );

  assert.equal(result.data.summary.duplicateRows, 1);
  assert.equal(savedRows[0].status, 'DUPLICATE');
});

test('14 - rejects invalid Exam ID during preview', async () => {
  const { service, prisma } = createService();

  let savedRows;

  prisma.importRow.createMany = async ({ data }) => {
    savedRows = data;
    return { count: data.length };
  };

  const row = validRow({
    occurrences: [
      {
        institution: 'PSC',
        examId: 'invalid-id',
      },
    ],
  });

  const result = await service.preview(jsonFile([row]));

  assert.equal(result.data.summary.invalidRows, 1);
  assert.equal(savedRows[0].status, 'INVALID');
});

test('15 - rejects non-existing Exam reference', async () => {
  const { service, prisma } = createService();

  prisma.exam.findUnique = async () => null;

  let savedRows;

  prisma.importRow.createMany = async ({ data }) => {
    savedRows = data;
    return { count: data.length };
  };

  const row = validRow({
    occurrences: [
      {
        institution: 'PSC',
        examId: '123e4567-e89b-42d3-a456-426614174000',
      },
    ],
  });

  const result = await service.preview(jsonFile([row]));

  assert.equal(result.data.summary.invalidRows, 1);
  assert.equal(savedRows[0].status, 'INVALID');
});

test('16 - marks batch FAILED if preview processing fails', async () => {
  const { service, prisma } = createService();

  prisma.importRow.createMany = async () => {
    throw new Error('Database failure');
  };

  let failureUpdate;

  prisma.importBatch.update = async ({ data }) => {
    failureUpdate = data;
    return {};
  };

  await assert.rejects(
    service.preview(jsonFile([validRow()])),
    /Database failure/,
  );

  assert.equal(failureUpdate.status, 'FAILED');
  assert.equal(
    failureUpdate.errorSummary.message,
    'Database failure',
  );
});

// =====================================================
// IMPORT BATCH LISTING
// =====================================================

test('17 - returns import batches with pagination', async () => {
  const { service, prisma } = createService();

  prisma.importBatch.findMany = async () => [
    { id: BATCH_ID },
  ];

  prisma.importBatch.count = async () => 25;

  const result = await service.findAll(2, 10);

  assert.equal(result.success, true);
  assert.equal(result.data.length, 1);
  assert.deepEqual(result.pagination, {
    total: 25,
    page: 2,
    limit: 10,
    totalPages: 3,
  });
});

test('18 - limits import batch page size to 100', async () => {
  const { service, prisma } = createService();

  let args;

  prisma.importBatch.findMany = async (value) => {
    args = value;
    return [];
  };

  await service.findAll(1, 500);

  assert.equal(args.take, 100);
});

test('19 - throws NotFoundException for missing batch', async () => {
  const { service, prisma } = createService();

  prisma.importBatch.findUnique = async () => null;

  await assert.rejects(
    service.findOne('missing-batch'),
    NotFoundException,
  );
});

test('20 - returns batch with rows', async () => {
  const { service, prisma } = createService();

  const batch = {
    id: BATCH_ID,
    rows: [{ rowNumber: 1 }],
  };

  prisma.importBatch.findUnique = async () => batch;

  const result = await service.findOne(BATCH_ID);

  assert.equal(result.success, true);
  assert.equal(result.data, batch);
});

// =====================================================
// IMPORT ROW LISTING
// =====================================================

test('21 - throws NotFoundException when listing rows of missing batch', async () => {
  const { service, prisma } = createService();

  prisma.importBatch.findUnique = async () => null;

  await assert.rejects(
    service.findRows('missing-batch'),
    NotFoundException,
  );
});

test('22 - returns rows with status filter and pagination', async () => {
  const { service, prisma } = createService();

  let findArgs;

  prisma.importRow.findMany = async (args) => {
    findArgs = args;
    return [{ id: 'row-001' }];
  };

  prisma.importRow.count = async () => 12;

  const result = await service.findRows(
    BATCH_ID,
    'VALID',
    2,
    5,
  );

  assert.equal(findArgs.where.batchId, BATCH_ID);
  assert.equal(findArgs.where.status, 'VALID');
  assert.equal(findArgs.skip, 5);
  assert.equal(findArgs.take, 5);
  assert.equal(result.pagination.totalPages, 3);
});

test('23 - rejects invalid import row status', async () => {
  const { service } = createService();

  await assert.rejects(
    service.findRows(BATCH_ID, 'UNKNOWN'),
    BadRequestException,
  );
});

// =====================================================
// MANUAL DUPLICATE REVIEW
// =====================================================

test('manually passing a duplicate persists the override and revalidates it as valid', async () => {
  const { service, prisma } = createService();
  const row = {
    id: 'row-duplicate',
    rowNumber: 2,
    status: 'DUPLICATE',
    rawData: validRow(),
  };
  let questionLookups = 0;

  prisma.importBatch.findUnique = async () => ({
    id: BATCH_ID,
    status: 'REVIEW',
  });
  prisma.importBatch.update = async ({ data }) => ({ id: BATCH_ID, ...data });
  prisma.importRow.findMany = async () => [row];
  prisma.importRow.update = async ({ data }) => {
    row.rawData = data.rawData;
    if (data.status) row.status = data.status;
    return row;
  };
  prisma.question.findFirst = async () => {
    questionLookups++;
    return { id: 'existing-question' };
  };

  const result = await service.reviewDuplicates(
    BATCH_ID,
    ['row-duplicate'],
    'PASS',
  );

  assert.equal(result.success, true);
  assert.equal(result.data.updatedRows, 1);
  assert.equal(result.data.summary.validRows, 1);
  assert.equal(result.data.summary.duplicateRows, 0);
  assert.equal(row.status, 'VALID');
  assert.equal(row.rawData._importReviewOverride.duplicate, 'PASS');
  assert.equal(questionLookups, 0);
});

// =====================================================
// SKIP ROWS
// =====================================================

test('24 - rejects empty row ID list', async () => {
  const { service } = createService();

  await assert.rejects(
    service.skipRows(BATCH_ID, []),
    BadRequestException,
  );
});

test('25 - throws NotFoundException when skipping rows of missing batch', async () => {
  const { service, prisma } = createService();

  prisma.importBatch.updateMany = async () => ({
    count: 0,
  });

  prisma.importBatch.findUnique = async () => null;

  await assert.rejects(
    service.skipRows(BATCH_ID, ['row-001']),
    NotFoundException,
  );
});

test('26 - rejects skipping rows when batch is not in REVIEW status', async () => {
  const { service, prisma } = createService();

  prisma.importBatch.updateMany = async () => ({
    count: 0,
  });

  prisma.importBatch.findUnique = async () => ({
    id: BATCH_ID,
  });

  await assert.rejects(
    service.skipRows(BATCH_ID, ['row-001']),
    BadRequestException,
  );
});

test('27 - skips selected rows successfully', async () => {
  const { service, prisma } = createService();

  let rowUpdateArgs;
  const batchUpdateCalls = [];

  prisma.importRow.updateMany = async (args) => {
    rowUpdateArgs = args;
    return { count: 2 };
  };

  prisma.importBatch.update = async (args) => {
    batchUpdateCalls.push(args);
    return {};
  };

  const result = await service.skipRows(
    BATCH_ID,
    ['row-001', 'row-002'],
  );

  assert.equal(result.success, true);
  assert.equal(result.data.skippedRows, 2);
  assert.deepEqual(rowUpdateArgs.where.id.in, ['row-001', 'row-002']);
  assert.equal(rowUpdateArgs.data.status, 'SKIPPED');

  assert.equal(
    batchUpdateCalls.some(
      (args) => args.data.skippedRows?.increment === 2,
    ),
    true,
  );
});

test('28 - does not increment skipped count when no rows match', async () => {
  const { service, prisma } = createService();

  const batchUpdateCalls = [];

  prisma.importRow.updateMany = async () => ({ count: 0 });

  prisma.importBatch.update = async (args) => {
    batchUpdateCalls.push(args);
    return {};
  };

  const result = await service.skipRows(
    BATCH_ID,
    ['unknown-row'],
  );

  assert.equal(result.data.skippedRows, 0);

  assert.equal(
    batchUpdateCalls.some(
      (args) => args.data.skippedRows?.increment !== undefined,
    ),
    false,
  );
});
