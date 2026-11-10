
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BadRequestException,
  NotFoundException,
  ConflictException,
} = require('@nestjs/common');

const {
  ImportsRollbackService,
} = require('../dist/modules/imports/imports-rollback.service');

const startedAt = new Date('2026-01-01T10:00:00.000Z');
const completedAt = new Date('2026-01-01T11:00:00.000Z');

function createBatch(overrides = {}) {
  return {
    id: 'batch-001',
    status: 'COMPLETED',
    startedAt,
    completedAt,
    rows: [
      { id: 'row-001', questionId: 'question-001' },
      { id: 'row-002', questionId: 'question-002' },
    ],
    ...overrides,
  };
}

function createQuestions(ids = ['question-001', 'question-002']) {
  return ids.map((id) => ({
    id,
    createdAt: new Date('2026-01-01T10:15:00.000Z'),
    updatedAt: new Date('2026-01-01T10:30:00.000Z'),
    deletedAt: null,
  }));
}

function createService(options = {}) {
  const batch = options.batch === undefined
    ? createBatch()
    : options.batch;

  const questions = options.questions === undefined
    ? createQuestions()
    : options.questions;

  const prisma = {
    importBatch: {
      findUnique: async () => batch,
      update: async ({ data }) => ({
        status: data.status,
        rolledBackAt: data.rolledBackAt,
      }),
    },

    question: {
      findMany: async () => questions,
      updateMany: async () => ({
        count: questions.length,
      }),
    },

    importRow: {
      findMany: async () => [],
    },

    $transaction: async (callback) => callback(prisma),
  };

  const service = new ImportsRollbackService(prisma);

  return {
    service,
    prisma,
    batch,
    questions,
  };
}

// --------------------------------------------------
// 1. Basic Rollback
// --------------------------------------------------

test('rollback successfully rolls back a completed batch', async () => {
  const { service } = createService();

  const result = await service.rollback('batch-001');

  assert.equal(result.success, true);
  assert.equal(
    result.message,
    'Import batch rolled back successfully.',
  );
  assert.equal(result.data.batchId, 'batch-001');
  assert.equal(result.data.status, 'ROLLED_BACK');
  assert.equal(result.data.rolledBackQuestions, 2);
  assert.ok(result.data.rolledBackAt instanceof Date);
});

test('rollback returns the correct batch ID', async () => {
  const { service } = createService();

  const result = await service.rollback('batch-123');

  assert.equal(result.data.batchId, 'batch-123');
});

test('rollback queries batch using the supplied ID', async () => {
  const { service, prisma } = createService();

  let query;

  prisma.importBatch.findUnique = async (args) => {
    query = args;
    return createBatch();
  };

  await service.rollback('batch-001');

  assert.deepEqual(query.where, {
    id: 'batch-001',
  });
});

test('rollback selects only imported rows with non-null question IDs', async () => {
  const { service, prisma } = createService();

  let query;

  prisma.importBatch.findUnique = async (args) => {
    query = args;
    return createBatch();
  };

  await service.rollback('batch-001');

  assert.deepEqual(query.include.rows.where, {
    status: 'IMPORTED',
    questionId: {
      not: null,
    },
  });

  assert.deepEqual(query.include.rows.select, {
    id: true,
    questionId: true,
  });
});

test('rollback runs inside Prisma transaction', async () => {
  const { service, prisma } = createService();

  let transactionCalled = false;

  prisma.$transaction = async (callback) => {
    transactionCalled = true;
    return callback(prisma);
  };

  await service.rollback('batch-001');

  assert.equal(transactionCalled, true);
});

// --------------------------------------------------
// 2. Batch Validation
// --------------------------------------------------

test('rollback rejects missing batch', async () => {
  const { service } = createService({
    batch: null,
  });

  await assert.rejects(
    service.rollback('missing-batch'),
    NotFoundException,
  );
});

test('rollback rejects batch that is not COMPLETED', async () => {
  const { service } = createService({
    batch: createBatch({
      status: 'REVIEW',
    }),
  });

  await assert.rejects(
    service.rollback('batch-001'),
    BadRequestException,
  );
});

test('rollback rejects PROCESSING batch', async () => {
  const { service } = createService({
    batch: createBatch({
      status: 'PROCESSING',
    }),
  });

  await assert.rejects(
    service.rollback('batch-001'),
    BadRequestException,
  );
});

test('rollback rejects batch without startedAt', async () => {
  const { service } = createService({
    batch: createBatch({
      startedAt: null,
    }),
  });

  await assert.rejects(
    service.rollback('batch-001'),
    BadRequestException,
  );
});

test('rollback rejects batch without completedAt', async () => {
  const { service } = createService({
    batch: createBatch({
      completedAt: null,
    }),
  });

  await assert.rejects(
    service.rollback('batch-001'),
    BadRequestException,
  );
});

test('rollback rejects batch without imported questions', async () => {
  const { service } = createService({
    batch: createBatch({
      rows: [],
    }),
  });

  await assert.rejects(
    service.rollback('batch-001'),
    BadRequestException,
  );
});

test('rollback rejects rows containing only null question IDs', async () => {
  const { service } = createService({
    batch: createBatch({
      rows: [
        { id: 'row-001', questionId: null },
      ],
    }),
  });

  await assert.rejects(
    service.rollback('batch-001'),
    BadRequestException,
  );
});

// --------------------------------------------------
// 3. Question ID Handling
// --------------------------------------------------

test('rollback removes duplicate question IDs before processing', async () => {
  const { service, prisma } = createService({
    batch: createBatch({
      rows: [
        { id: 'row-001', questionId: 'question-001' },
        { id: 'row-002', questionId: 'question-001' },
        { id: 'row-003', questionId: 'question-002' },
      ],
    }),
  });

  let questionQuery;

  prisma.question.findMany = async (args) => {
    questionQuery = args;
    return createQuestions();
  };

  const result = await service.rollback('batch-001');

  assert.deepEqual(
    questionQuery.where.id.in,
    ['question-001', 'question-002'],
  );

  assert.equal(result.data.rolledBackQuestions, 2);
});

test('rollback rejects when some imported questions are missing', async () => {
  const { service } = createService({
    questions: [
      createQuestions(['question-001'])[0],
    ],
  });

  await assert.rejects(
    service.rollback('batch-001'),
    ConflictException,
  );
});

test('rollback queries questions using selected IDs', async () => {
  const { service, prisma } = createService();

  let query;

  prisma.question.findMany = async (args) => {
    query = args;
    return createQuestions();
  };

  await service.rollback('batch-001');

  assert.deepEqual(query.where.id.in, [
    'question-001',
    'question-002',
  ]);
});

test('rollback selects question timestamps and deletion status', async () => {
  const { service, prisma } = createService();

  let query;

  prisma.question.findMany = async (args) => {
    query = args;
    return createQuestions();
  };

  await service.rollback('batch-001');

  assert.deepEqual(query.select, {
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
  });
});

// --------------------------------------------------
// 4. Question Safety Validation
// --------------------------------------------------

test('rollback rejects already deleted imported questions', async () => {
  const questions = createQuestions();

  questions[0].deletedAt = new Date(
    '2026-01-01T10:45:00.000Z',
  );

  const { service } = createService({
    questions,
  });

  await assert.rejects(
    service.rollback('batch-001'),
    ConflictException,
  );
});

test('rollback rejects questions created before import started', async () => {
  const questions = createQuestions();

  questions[0].createdAt = new Date(
    '2025-12-31T23:59:59.000Z',
  );

  const { service } = createService({
    questions,
  });

  await assert.rejects(
    service.rollback('batch-001'),
    ConflictException,
  );
});

test('rollback accepts questions created exactly at import start', async () => {
  const questions = createQuestions();

  questions[0].createdAt = startedAt;

  const { service } = createService({
    questions,
  });

  const result = await service.rollback('batch-001');

  assert.equal(result.success, true);
});

test('rollback rejects questions updated after import completed', async () => {
  const questions = createQuestions();

  questions[0].updatedAt = new Date(
    '2026-01-01T11:00:01.000Z',
  );

  const { service } = createService({
    questions,
  });

  await assert.rejects(
    service.rollback('batch-001'),
    ConflictException,
  );
});

test('rollback accepts questions updated exactly at import completion', async () => {
  const questions = createQuestions();

  questions[0].updatedAt = completedAt;

  const { service } = createService({
    questions,
  });

  const result = await service.rollback('batch-001');

  assert.equal(result.success, true);
});

test('rollback reports the number of unsafe questions', async () => {
  const questions = createQuestions();

  questions[0].deletedAt = new Date();
  questions[1].updatedAt = new Date(
    '2026-01-01T12:00:00.000Z',
  );

  const { service } = createService({
    questions,
  });

  await assert.rejects(
    service.rollback('batch-001'),
    /2 imported question\(s\) were modified or deleted/,
  );
});

// --------------------------------------------------
// 5. Cross-Batch Reference Validation
// --------------------------------------------------

test('rollback checks references from other import batches', async () => {
  const { service, prisma } = createService();

  let query;

  prisma.importRow.findMany = async (args) => {
    query = args;
    return [];
  };

  await service.rollback('batch-001');

  assert.deepEqual(query.where, {
    questionId: {
      in: ['question-001', 'question-002'],
    },
    batchId: {
      not: 'batch-001',
    },
  });

  assert.deepEqual(query.select, {
    questionId: true,
  });

  assert.deepEqual(query.distinct, ['questionId']);
});

test('rollback rejects questions referenced by another batch', async () => {
  const { service, prisma } = createService();

  prisma.importRow.findMany = async () => [
    { questionId: 'question-001' },
  ];

  await assert.rejects(
    service.rollback('batch-001'),
    ConflictException,
  );
});

test('rollback does not update questions when another batch references them', async () => {
  const { service, prisma } = createService();

  let updateCalled = false;

  prisma.importRow.findMany = async () => [
    { questionId: 'question-001' },
  ];

  prisma.question.updateMany = async () => {
    updateCalled = true;
    return { count: 0 };
  };

  await assert.rejects(
    service.rollback('batch-001'),
    ConflictException,
  );

  assert.equal(updateCalled, false);
});

// --------------------------------------------------
// 6. Soft Delete and Batch Update
// --------------------------------------------------

test('rollback soft deletes imported questions', async () => {
  const { service, prisma } = createService();

  let updateQuery;

  prisma.question.updateMany = async (args) => {
    updateQuery = args;
    return { count: 2 };
  };

  await service.rollback('batch-001');

  assert.deepEqual(updateQuery.where, {
    id: {
      in: ['question-001', 'question-002'],
    },
    deletedAt: null,
  });

  assert.ok(updateQuery.data.deletedAt instanceof Date);
});

test('rollback updates batch status to ROLLED_BACK', async () => {
  const { service, prisma } = createService();

  let updateQuery;

  prisma.importBatch.update = async (args) => {
    updateQuery = args;

    return {
      status: args.data.status,
      rolledBackAt: args.data.rolledBackAt,
    };
  };

  await service.rollback('batch-001');

  assert.deepEqual(updateQuery.where, {
    id: 'batch-001',
  });

  assert.equal(updateQuery.data.status, 'ROLLED_BACK');
  assert.ok(updateQuery.data.rolledBackAt instanceof Date);
});

test('rollback returns the updated batch status', async () => {
  const { service } = createService();

  const result = await service.rollback('batch-001');

  assert.equal(result.data.status, 'ROLLED_BACK');
});

test('rollback reports unique question count', async () => {
  const { service } = createService({
    batch: createBatch({
      rows: [
        { id: 'row-001', questionId: 'question-001' },
        { id: 'row-002', questionId: 'question-001' },
        { id: 'row-003', questionId: 'question-002' },
      ],
    }),
  });

  const result = await service.rollback('batch-001');

  assert.equal(result.data.rolledBackQuestions, 2);
});

// --------------------------------------------------
// 7. Error Propagation
// --------------------------------------------------

test('rollback propagates question lookup database errors', async () => {
  const { service, prisma } = createService();

  prisma.question.findMany = async () => {
    throw new Error('Question lookup failed');
  };

  await assert.rejects(
    service.rollback('batch-001'),
    /Question lookup failed/,
  );
});

test('rollback propagates external reference lookup errors', async () => {
  const { service, prisma } = createService();

  prisma.importRow.findMany = async () => {
    throw new Error('Import row lookup failed');
  };

  await assert.rejects(
    service.rollback('batch-001'),
    /Import row lookup failed/,
  );
});

test('rollback propagates question update errors', async () => {
  const { service, prisma } = createService();

  prisma.question.updateMany = async () => {
    throw new Error('Question update failed');
  };

  await assert.rejects(
    service.rollback('batch-001'),
    /Question update failed/,
  );
});

test('rollback propagates batch update errors', async () => {
  const { service, prisma } = createService();

  prisma.importBatch.update = async () => {
    throw new Error('Batch update failed');
  };

  await assert.rejects(
    service.rollback('batch-001'),
    /Batch update failed/,
  );
});

test('rollback propagates transaction errors', async () => {
  const { service, prisma } = createService();

  prisma.$transaction = async () => {
    throw new Error('Transaction failed');
  };

  await assert.rejects(
    service.rollback('batch-001'),
    /Transaction failed/,
  );
});
