
const test = require('node:test');
const assert = require('node:assert/strict');

const { AnalyticsService } = require('../dist/modules/analytics/analytics.service');

function createMocks(overrides = {}) {
  const prisma = {
    question: {
      count: async () => 0,
      groupBy: async () => [],
      ...overrides.question,
    },
    subject: {
      count: async () => 0,
      findMany: async () => [],
      ...overrides.subject,
    },
    topic: {
      count: async () => 0,
      findMany: async () => [],
      ...overrides.topic,
    },
    questionOccurrence: {
      count: async () => 0,
      groupBy: async () => [],
      ...overrides.questionOccurrence,
    },
    questionReview: {
      count: async () => 0,
      groupBy: async () => [],
      ...overrides.questionReview,
    },
    duplicateCandidate: {
      count: async () => 0,
      groupBy: async () => [],
      ...overrides.duplicateCandidate,
    },
    importBatch: {
      count: async () => 0,
      groupBy: async () => [],
      ...overrides.importBatch,
    },
    importRow: {
      count: async () => 0,
      groupBy: async () => [],
      ...overrides.importRow,
    },
  };

  return {
    service: new AnalyticsService(prisma),
    prisma,
  };
}

// OVERVIEW TESTS

test('overview returns total and deleted question counts', async () => {
  const { service } = createMocks({
    question: {
      count: async ({ where }) => {
        if (where.deletedAt === null) return 100;
        return 10;
      },
      groupBy: async () => [],
    },
  });

  const result = await service.overview();

  assert.equal(result.success, true);
  assert.equal(result.data.questions.total, 100);
  assert.equal(result.data.questions.deleted, 10);
});

test('overview returns question status counts', async () => {
  const { service } = createMocks({
    question: {
      groupBy: async () => [
        { status: 'DRAFT', _count: { _all: 5 } },
        { status: 'PUBLISHED', _count: { _all: 20 } },
        { status: 'HIDDEN', _count: { _all: 3 } },
        { status: 'ARCHIVED', _count: { _all: 2 } },
      ],
    },
  });

  const result = await service.overview();

  assert.equal(result.data.questions.draft, 5);
  assert.equal(result.data.questions.published, 20);
  assert.equal(result.data.questions.hidden, 3);
  assert.equal(result.data.questions.archived, 2);
});

test('overview defaults missing question statuses to zero', async () => {
  const { service } = createMocks();

  const result = await service.overview();

  assert.equal(result.data.questions.draft, 0);
  assert.equal(result.data.questions.published, 0);
  assert.equal(result.data.questions.hidden, 0);
  assert.equal(result.data.questions.archived, 0);
});

test('overview returns all related module counts', async () => {
  const { service } = createMocks({
    subject: { count: async () => 8 },
    topic: { count: async () => 30 },
    questionOccurrence: { count: async () => 150 },
    questionReview: { count: async () => 12 },
    duplicateCandidate: { count: async () => 7 },
    importBatch: { count: async () => 4 },
  });

  const result = await service.overview();

  assert.equal(result.data.subjects, 8);
  assert.equal(result.data.topics, 30);
  assert.equal(result.data.occurrences, 150);
  assert.equal(result.data.reviews, 12);
  assert.equal(result.data.duplicates, 7);
  assert.equal(result.data.importBatches, 4);
});

test('overview counts only active and deleted questions separately', async () => {
  const calls = [];

  const { service } = createMocks({
    question: {
      count: async (args) => {
        calls.push(args);
        return 0;
      },
    },
  });

  await service.overview();

  assert.deepEqual(calls, [
    { where: { deletedAt: null } },
    { where: { deletedAt: { not: null } } },
  ]);
});

// SUBJECT ANALYTICS TESTS

test('questionsBySubject returns subject question counts', async () => {
  const subjects = [
    {
      id: 'subject-1',
      name: 'Bangla',
      slug: 'bangla',
      isActive: true,
      _count: { questions: 25 },
    },
    {
      id: 'subject-2',
      name: 'English',
      slug: 'english',
      isActive: false,
      _count: { questions: 10 },
    },
  ];

  const { service } = createMocks({
    subject: {
      findMany: async () => subjects,
    },
  });

  const result = await service.questionsBySubject();

  assert.equal(result.success, true);
  assert.equal(result.data.length, 2);
  assert.equal(result.data[0].name, 'Bangla');
  assert.equal(result.data[0].questionCount, 25);
  assert.equal(result.data[1].questionCount, 10);
});

test('questionsBySubject returns empty array when no subjects exist', async () => {
  const { service } = createMocks();

  const result = await service.questionsBySubject();

  assert.deepEqual(result.data, []);
});

test('questionsBySubject counts only non-deleted questions', async () => {
  let receivedArgs;

  const { service } = createMocks({
    subject: {
      findMany: async (args) => {
        receivedArgs = args;
        return [];
      },
    },
  });

  await service.questionsBySubject();

  assert.deepEqual(
    receivedArgs.include._count.select.questions.where,
    { deletedAt: null },
  );
});

test('questionsBySubject orders subjects by name ascending', async () => {
  let receivedArgs;

  const { service } = createMocks({
    subject: {
      findMany: async (args) => {
        receivedArgs = args;
        return [];
      },
    },
  });

  await service.questionsBySubject();

  assert.deepEqual(receivedArgs.orderBy, { name: 'asc' });
});

// TOPIC ANALYTICS TESTS

test('questionsByTopic returns topic information and question counts', async () => {
  const topics = [
    {
      id: 'topic-1',
      name: 'Grammar',
      slug: 'grammar',
      subject: {
        id: 'subject-1',
        name: 'English',
      },
      isActive: true,
      _count: { questions: 40 },
    },
  ];

  const { service } = createMocks({
    topic: {
      findMany: async () => topics,
    },
  });

  const result = await service.questionsByTopic();

  assert.equal(result.success, true);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].name, 'Grammar');
  assert.equal(result.data[0].subject.name, 'English');
  assert.equal(result.data[0].questionCount, 40);
});

test('questionsByTopic returns empty array when no topics exist', async () => {
  const { service } = createMocks();

  const result = await service.questionsByTopic();

  assert.deepEqual(result.data, []);
});

test('questionsByTopic counts only non-deleted questions', async () => {
  let receivedArgs;

  const { service } = createMocks({
    topic: {
      findMany: async (args) => {
        receivedArgs = args;
        return [];
      },
    },
  });

  await service.questionsByTopic();

  assert.deepEqual(
    receivedArgs.include._count.select.questions.where,
    { deletedAt: null },
  );
});

test('questionsByTopic orders by subject and topic name', async () => {
  let receivedArgs;

  const { service } = createMocks({
    topic: {
      findMany: async (args) => {
        receivedArgs = args;
        return [];
      },
    },
  });

  await service.questionsByTopic();

  assert.deepEqual(receivedArgs.orderBy, [
    { subjectId: 'asc' },
    { name: 'asc' },
  ]);
});

// EXAM ANALYTICS TESTS

test('questionsByExam returns exam groups and question counts', async () => {
  const groups = [
    {
      institution: 'PSC',
      examName: 'Primary Assistant Teacher',
      examYear: 2024,
      _count: { _all: 50 },
    },
    {
      institution: 'BPSC',
      examName: 'BCS Preliminary',
      examYear: 2023,
      _count: { _all: 100 },
    },
  ];

  const { service } = createMocks({
    questionOccurrence: {
      groupBy: async () => groups,
    },
  });

  const result = await service.questionsByExam();

  assert.equal(result.success, true);
  assert.equal(result.data.length, 2);
  assert.equal(result.data[0].institution, 'PSC');
  assert.equal(result.data[0].questionCount, 50);
  assert.equal(result.data[1].questionCount, 100);
  assert.equal(result.meta.totalGroups, 2);
});

test('questionsByExam returns zero groups when no occurrences exist', async () => {
  const { service } = createMocks();

  const result = await service.questionsByExam();

  assert.deepEqual(result.data, []);
  assert.equal(result.meta.totalGroups, 0);
});

test('questionsByExam groups by institution, exam name and year', async () => {
  let receivedArgs;

  const { service } = createMocks({
    questionOccurrence: {
      groupBy: async (args) => {
        receivedArgs = args;
        return [];
      },
    },
  });

  await service.questionsByExam();

  assert.deepEqual(receivedArgs.by, [
    'institution',
    'examName',
    'examYear',
  ]);
});

test('questionsByExam applies requested ordering', async () => {
  let receivedArgs;

  const { service } = createMocks({
    questionOccurrence: {
      groupBy: async (args) => {
        receivedArgs = args;
        return [];
      },
    },
  });

  await service.questionsByExam();

  assert.deepEqual(receivedArgs.orderBy, [
    { examYear: 'desc' },
    { examName: 'asc' },
  ]);
});

// REVIEW REPORT TESTS

test('reviewReport returns review status counts and total', async () => {
  const { service } = createMocks({
    questionReview: {
      groupBy: async () => [
        { status: 'PENDING', _count: { _all: 5 } },
        { status: 'APPROVED', _count: { _all: 10 } },
        { status: 'REJECTED', _count: { _all: 2 } },
      ],
      count: async () => 17,
    },
  });

  const result = await service.reviewReport();

  assert.equal(result.success, true);
  assert.equal(result.data.length, 3);
  assert.equal(result.data[0].status, 'PENDING');
  assert.equal(result.data[0].count, 5);
  assert.equal(result.meta.total, 17);
});

test('reviewReport returns empty groups and zero total', async () => {
  const { service } = createMocks();

  const result = await service.reviewReport();

  assert.deepEqual(result.data, []);
  assert.equal(result.meta.total, 0);
});

// DUPLICATE REPORT TESTS

test('duplicateReport returns duplicate status counts and total', async () => {
  const { service } = createMocks({
    duplicateCandidate: {
      groupBy: async () => [
        { status: 'PENDING', _count: { _all: 4 } },
        { status: 'CONFIRMED', _count: { _all: 8 } },
        { status: 'REJECTED', _count: { _all: 3 } },
      ],
      count: async () => 15,
    },
  });

  const result = await service.duplicateReport();

  assert.equal(result.success, true);
  assert.equal(result.data.length, 3);
  assert.equal(result.data[1].status, 'CONFIRMED');
  assert.equal(result.data[1].count, 8);
  assert.equal(result.meta.total, 15);
});

test('duplicateReport returns empty groups and zero total', async () => {
  const { service } = createMocks();

  const result = await service.duplicateReport();

  assert.deepEqual(result.data, []);
  assert.equal(result.meta.total, 0);
});

// IMPORT REPORT TESTS

test('importReport returns batch and row status counts', async () => {
  const { service } = createMocks({
    importBatch: {
      groupBy: async () => [
        { status: 'COMPLETED', _count: { _all: 5 } },
        { status: 'FAILED', _count: { _all: 2 } },
      ],
      count: async () => 7,
    },
    importRow: {
      groupBy: async () => [
        { status: 'IMPORTED', _count: { _all: 40 } },
        { status: 'INVALID', _count: { _all: 3 } },
      ],
      count: async () => 43,
    },
  });

  const result = await service.importReport();

  assert.equal(result.success, true);
  assert.equal(result.data.batches.length, 2);
  assert.equal(result.data.rows.length, 2);
  assert.equal(result.data.batches[0].count, 5);
  assert.equal(result.data.rows[0].count, 40);
});

test('importReport returns total batches and rows', async () => {
  const { service } = createMocks({
    importBatch: {
      count: async () => 12,
    },
    importRow: {
      count: async () => 250,
    },
  });

  const result = await service.importReport();

  assert.equal(result.meta.totalBatches, 12);
  assert.equal(result.meta.totalRows, 250);
});

test('importReport returns empty groups when no imports exist', async () => {
  const { service } = createMocks();

  const result = await service.importReport();

  assert.deepEqual(result.data.batches, []);
  assert.deepEqual(result.data.rows, []);
  assert.equal(result.meta.totalBatches, 0);
  assert.equal(result.meta.totalRows, 0);
});

// QUESTION QUALITY TESTS

test('questionQuality returns total active questions', async () => {
  const { service } = createMocks({
    question: {
      count: async ({ where }) => {
        if (
          where.correctAnswer === undefined &&
          where.explanation === undefined
        ) {
          return 100;
        }

        return 0;
      },
    },
  });

  const result = await service.questionQuality();

  assert.equal(result.success, true);
  assert.equal(result.data.total, 100);
});

test('questionQuality returns questions with and without answers', async () => {
  const { service } = createMocks({
    question: {
      count: async ({ where }) => {
        if (where.correctAnswer) return 75;
        if (where.OR?.some((item) => 'correctAnswer' in item)) return 25;
        return 100;
      },
    },
  });

  const result = await service.questionQuality();

  assert.equal(result.data.answers.withAnswer, 75);
  assert.equal(result.data.answers.withoutAnswer, 25);
});

test('questionQuality returns questions with and without explanations', async () => {
  const { service } = createMocks({
    question: {
      count: async ({ where }) => {
        if (where.explanation) return 60;
        if (where.OR?.some((item) => 'explanation' in item)) return 40;
        return 100;
      },
    },
  });

  const result = await service.questionQuality();

  assert.equal(result.data.explanations.withExplanation, 60);
  assert.equal(result.data.explanations.withoutExplanation, 40);
});

test('questionQuality excludes deleted questions from all counts', async () => {
  const calls = [];

  const { service } = createMocks({
    question: {
      count: async (args) => {
        calls.push(args);
        return 0;
      },
    },
  });

  await service.questionQuality();

  assert.equal(calls.length, 5);

  for (const call of calls) {
    assert.equal(call.where.deletedAt, null);
  }
});

test('questionQuality separates empty and null answers', async () => {
  const calls = [];

  const { service } = createMocks({
    question: {
      count: async (args) => {
        calls.push(args);
        return 0;
      },
    },
  });

  await service.questionQuality();

  const withoutAnswerQuery = calls.find(
    (item) =>
      item.where.OR?.some((condition) => 'correctAnswer' in condition),
  );

  assert.ok(withoutAnswerQuery);

  assert.deepEqual(withoutAnswerQuery.where, {
    deletedAt: null,
    OR: [
      { correctAnswer: null },
      { correctAnswer: '' },
    ],
  });
});

test('questionQuality separates empty and null explanations', async () => {
  const calls = [];

  const { service } = createMocks({
    question: {
      count: async (args) => {
        calls.push(args);
        return 0;
      },
    },
  });

  await service.questionQuality();

  const explanationQuery = calls.find(
    (item) =>
      item.where.OR?.some((condition) => 'explanation' in condition),
  );

  assert.ok(explanationQuery);

  assert.deepEqual(explanationQuery.where.OR, [
    { explanation: null },
    { explanation: '' },
  ]);
});

// ERROR HANDLING TESTS

test('overview propagates Prisma errors', async () => {
  const { service } = createMocks({
    question: {
      count: async () => {
        throw new Error('Database error');
      },
    },
  });

  await assert.rejects(
    service.overview(),
    /Database error/,
  );
});

test('questionsBySubject propagates Prisma errors', async () => {
  const { service } = createMocks({
    subject: {
      findMany: async () => {
        throw new Error('Subject query failed');
      },
    },
  });

  await assert.rejects(
    service.questionsBySubject(),
    /Subject query failed/,
  );
});

test('questionsByTopic propagates Prisma errors', async () => {
  const { service } = createMocks({
    topic: {
      findMany: async () => {
        throw new Error('Topic query failed');
      },
    },
  });

  await assert.rejects(
    service.questionsByTopic(),
    /Topic query failed/,
  );
});

test('questionsByExam propagates Prisma errors', async () => {
  const { service } = createMocks({
    questionOccurrence: {
      groupBy: async () => {
        throw new Error('Exam query failed');
      },
    },
  });

  await assert.rejects(
    service.questionsByExam(),
    /Exam query failed/,
  );
});

test('reviewReport propagates Prisma errors', async () => {
  const { service } = createMocks({
    questionReview: {
      groupBy: async () => {
        throw new Error('Review query failed');
      },
    },
  });

  await assert.rejects(
    service.reviewReport(),
    /Review query failed/,
  );
});

test('duplicateReport propagates Prisma errors', async () => {
  const { service } = createMocks({
    duplicateCandidate: {
      groupBy: async () => {
        throw new Error('Duplicate query failed');
      },
    },
  });

  await assert.rejects(
    service.duplicateReport(),
    /Duplicate query failed/,
  );
});

test('importReport propagates Prisma errors', async () => {
  const { service } = createMocks({
    importBatch: {
      groupBy: async () => {
        throw new Error('Import query failed');
      },
    },
  });

  await assert.rejects(
    service.importReport(),
    /Import query failed/,
  );
});

test('questionQuality propagates Prisma errors', async () => {
  const { service } = createMocks({
    question: {
      count: async () => {
        throw new Error('Quality query failed');
      },
    },
  });

  await assert.rejects(
    service.questionQuality(),
    /Quality query failed/,
  );
});

