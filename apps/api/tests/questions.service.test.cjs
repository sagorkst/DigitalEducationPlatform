
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BadRequestException,
  ConflictException,
  NotFoundException,
} = require('@nestjs/common');

const {
  QuestionsService,
} = require('../dist/modules/questions/questions.service');

const QUESTION_ID = '11111111-1111-4111-8111-111111111111';

const validOptions = [
  {
    label: 'A',
    optionText: 'Option A',
    isCorrect: true,
    sortOrder: 1,
  },
  {
    label: 'B',
    optionText: 'Option B',
    isCorrect: false,
    sortOrder: 2,
  },
];

function createExistingQuestion(overrides = {}) {
  return {
    id: QUESTION_ID,
    questionCode: 'Q-001',
    questionText: 'What is 2 + 2?',
    questionType: 'MCQ',
    subject: 'Mathematics',
    topic: 'Arithmetic',
    subjectId: null,
    topicId: null,
    correctAnswer: 'A',
    explanation: 'Basic addition.',
    difficulty: 'MEDIUM',
    status: 'DRAFT',
    repeatGroupId: null,
    deletedAt: null,
    options: validOptions,
    occurrences: [],
    ...overrides,
  };
}

function createService(prisma) {
  return new QuestionsService(prisma);
}

// ==========================================
// CREATE QUESTION TESTS
// ==========================================

test('01 - Reject MCQ without at least two options', async () => {
  const service = createService({});

  await assert.rejects(
    service.create({
      questionText: 'Test question',
      questionType: 'MCQ',
      subject: 'Math',
      topic: 'General',
      occurrences: [],
      options: [],
    }),
    BadRequestException,
  );
});

test('02 - accepts MCQ with no correct option selected', async () => {
  let receivedData;

  const prisma = {
    $transaction: async (callback) =>
      callback({
        question: {
          create: async (args) => {
            receivedData = args.data;
            return {
              id: QUESTION_ID,
              ...args.data,
              options: args.data.options.create,
              occurrences: [],
            };
          },
        },
      }),
  };

  const service = createService(prisma);
  const result = await service.create({
    questionText: 'Test question',
    questionType: 'MCQ',
    subject: 'Math',
    topic: 'General',
    occurrences: [],
    options: [
      { label: 'A', optionText: 'Option A', isCorrect: false },
      { label: 'B', optionText: 'Option B', isCorrect: false },
    ],
  });

  assert.equal(result.success, true);
  assert.deepEqual(
    receivedData.options.create.map((option) => option.isCorrect),
    [false, false],
  );
});

test('02b - accepts MCQ with multiple correct options', async () => {
  let receivedData;

  const prisma = {
    $transaction: async (callback) =>
      callback({
        question: {
          create: async (args) => {
            receivedData = args.data;
            return {
              id: QUESTION_ID,
              ...args.data,
              options: args.data.options.create,
              occurrences: [],
            };
          },
        },
      }),
  };

  const service = createService(prisma);
  const result = await service.create({
    questionText: 'Test question',
    questionType: 'MCQ',
    subject: 'Math',
    topic: 'General',
    occurrences: [],
    options: [
      { label: 'A', optionText: 'Option A', isCorrect: true },
      { label: 'B', optionText: 'Option B', isCorrect: true },
    ],
  });

  assert.equal(result.success, true);
  assert.deepEqual(
    receivedData.options.create.map((option) => option.isCorrect),
    [true, true],
  );
});

test('03 - Successfully create a valid MCQ question', async () => {
  let receivedData;

  const prisma = {
    $transaction: async (callback) =>
      callback({
        question: {
          create: async (args) => {
            receivedData = args.data;

            return {
              id: QUESTION_ID,
              ...args.data,
              options: validOptions,
              occurrences: [],
            };
          },
        },
      }),
  };

  const service = createService(prisma);

  const result = await service.create({
    questionText: 'What is 2 + 2?',
    questionType: 'MCQ',
    subject: 'Mathematics',
    topic: 'Arithmetic',
    correctAnswer: 'A',
    occurrences: [],
    options: validOptions,
  });

  assert.equal(result.success, true);
  assert.equal(result.data.questionText, 'What is 2 + 2?');
  assert.match(receivedData.questionCode, /^Q-/);
  assert.equal(receivedData.difficulty, 'MEDIUM');
  assert.equal(receivedData.status, 'DRAFT');
});

test('04 - Reject inactive or missing subject', async () => {
  const prisma = {
    $transaction: async (callback) =>
      callback({
        subject: {
          findFirst: async () => null,
        },
      }),
  };

  const service = createService(prisma);

  await assert.rejects(
    service.create({
      questionText: 'Test question',
      questionType: 'WRITTEN',
      subject: 'Math',
      topic: 'General',
      subjectId: QUESTION_ID,
      occurrences: [],
    }),
    BadRequestException,
  );
});

test('05 - Reject topic belonging to another subject', async () => {
  const prisma = {
    $transaction: async (callback) =>
      callback({
        subject: {
          findFirst: async () => ({
            id: QUESTION_ID,
            name: 'Mathematics',
            isActive: true,
          }),
        },
        topic: {
          findFirst: async () => ({
            id: 'topic-1',
            name: 'Algebra',
            subjectId: 'another-subject',
            isActive: true,
            subject: {
              id: 'another-subject',
              name: 'Science',
              isActive: true,
            },
          }),
        },
      }),
  };

  const service = createService(prisma);

  await assert.rejects(
    service.create({
      questionText: 'Test question',
      questionType: 'WRITTEN',
      subject: 'Mathematics',
      topic: 'Algebra',
      subjectId: QUESTION_ID,
      topicId: 'topic-1',
      occurrences: [],
    }),
    BadRequestException,
  );
});

test('06 - Reject occurrence linked to a nonexistent exam', async () => {
  const prisma = {
    $transaction: async (callback) =>
      callback({
        exam: {
          findUnique: async () => null,
        },
      }),
  };

  const service = createService(prisma);

  await assert.rejects(
    service.create({
      questionText: 'Test question',
      questionType: 'WRITTEN',
      subject: 'Math',
      topic: 'General',
      occurrences: [
        {
          institution: 'Test Institution',
          examName: 'Test Exam',
          examYear: 2025,
          examId: QUESTION_ID,
        },
      ],
    }),
    BadRequestException,
  );
});

test('07 - Reject institution mismatch with selected exam', async () => {
  const prisma = {
    $transaction: async (callback) =>
      callback({
        exam: {
          findUnique: async () => ({
            id: QUESTION_ID,
            name: 'BCS Preliminary',
            examYear: 2025,
            institutionId: 'institution-1',
            postId: 'post-1',
          }),
        },
      }),
  };

  const service = createService(prisma);

  await assert.rejects(
    service.create({
      questionText: 'Test question',
      questionType: 'WRITTEN',
      subject: 'Math',
      topic: 'General',
      occurrences: [
        {
          institution: 'Test Institution',
          examName: 'BCS Preliminary',
          examYear: 2025,
          examId: QUESTION_ID,
          institutionId: 'institution-2',
        },
      ],
    }),
    BadRequestException,
  );
});

// ==========================================
// FIND ALL / FILTER TESTS
// ==========================================

test('08 - Return paginated questions with default pagination', async () => {
  let receivedWhere;
  let receivedSkip;
  let receivedTake;

  const prisma = {
    question: {
      findMany: async (args) => {
        receivedWhere = args.where;
        receivedSkip = args.skip;
        receivedTake = args.take;

        return [createExistingQuestion()];
      },
      count: async () => 1,
    },
    $transaction: async (operations) => Promise.all(operations),
  };

  const service = createService(prisma);
  const result = await service.findAll({});

  assert.equal(receivedWhere.deletedAt, null);
  assert.equal(receivedSkip, 0);
  assert.equal(receivedTake, 20);
  assert.equal(result.data.length, 1);
  assert.equal(result.pagination.total, 1);
  assert.equal(result.pagination.page, 1);
});

test('09 - Enforce maximum page limit of 100', async () => {
  let receivedTake;

  const prisma = {
    question: {
      findMany: async (args) => {
        receivedTake = args.take;
        return [];
      },
      count: async () => 0,
    },
    $transaction: async (operations) => Promise.all(operations),
  };

  const service = createService(prisma);

  await service.findAll({
    page: '2',
    limit: '500',
  });

  assert.equal(receivedTake, 100);
});

test('10 - Reject invalid yearFrom', async () => {
  const service = createService({});

  await assert.rejects(
    service.findAll({ yearFrom: '1800' }),
    BadRequestException,
  );
});

test('11 - Reject yearFrom greater than yearTo', async () => {
  const service = createService({});

  await assert.rejects(
    service.findAll({
      yearFrom: '2025',
      yearTo: '2020',
    }),
    BadRequestException,
  );
});

test('12 - Reject invalid question type filter', async () => {
  const service = createService({});

  await assert.rejects(
    service.findAll({
      questionType: 'INVALID',
    }),
    BadRequestException,
  );
});

test('13 - Reject invalid difficulty filter', async () => {
  const service = createService({});

  await assert.rejects(
    service.findAll({
      difficulty: 'VERY_HARD',
    }),
    BadRequestException,
  );
});

test('14 - Reject invalid status filter', async () => {
  const service = createService({});

  await assert.rejects(
    service.findAll({
      status: 'INVALID',
    }),
    BadRequestException,
  );
});

test('15 - Reject invalid boolean filter', async () => {
  const service = createService({});

  await assert.rejects(
    service.findAll({
      hasAnswer: 'yes',
    }),
    BadRequestException,
  );
});

// ==========================================
// FIND ONE TESTS
// ==========================================

test('16 - Return question details with options and occurrences', async () => {
  const expectedQuestion = createExistingQuestion();

  const prisma = {
    question: {
      findFirst: async () => expectedQuestion,
    },
  };

  const service = createService(prisma);
  const result = await service.findOne(QUESTION_ID);

  assert.equal(result.success, true);
  assert.equal(result.data.id, QUESTION_ID);
});

test('17 - Reject nonexistent or deleted question details', async () => {
  let receivedWhere;

  const prisma = {
    question: {
      findFirst: async (args) => {
        receivedWhere = args.where;
        return null;
      },
    },
  };

  const service = createService(prisma);

  await assert.rejects(
    service.findOne(QUESTION_ID),
    NotFoundException,
  );

  assert.equal(receivedWhere.deletedAt, null);
});

// ==========================================
// UPDATE TESTS
// ==========================================

test('18 - Reject update when question does not exist', async () => {
  const prisma = {
    $transaction: async (callback) =>
      callback({
        question: {
          findFirst: async () => null,
        },
      }),
  };

  const service = createService(prisma);

  await assert.rejects(
    service.update(QUESTION_ID, {
      questionText: 'Updated question',
    }),
    NotFoundException,
  );
});

test('19 - Reject invalid MCQ options during update', async () => {
  const prisma = {
    $transaction: async (callback) =>
      callback({
        question: {
          findFirst: async () => createExistingQuestion(),
        },
      }),
  };

  const service = createService(prisma);

  await assert.rejects(
    service.update(QUESTION_ID, {
      options: [
        {
          label: 'A',
          optionText: 'Option A',
          isCorrect: false,
        },
      ],
    }),
    BadRequestException,
  );
});

test('20 - Successfully update question and save history', async () => {
  let historyCreated;
  let updateReceived;

  const prisma = {
    $transaction: async (callback) =>
      callback({
        question: {
          findFirst: async () => createExistingQuestion(),
          update: async (args) => {
            updateReceived = args.data;
            return { id: QUESTION_ID };
          },
          findUnique: async () => ({
            ...createExistingQuestion(),
            questionText: 'Updated question',
          }),
        },
        questionHistory: {
          findFirst: async () => null,
          create: async (args) => {
            historyCreated = args.data;
            return args.data;
          },
        },
      }),
  };

  const service = createService(prisma);

  const result = await service.update(QUESTION_ID, {
    questionText: 'Updated question',
    changeNote: 'Corrected question text',
  });

  assert.equal(result.success, true);
  assert.equal(result.version, 1);
  assert.equal(updateReceived.questionText, 'Updated question');
  assert.equal(historyCreated.version, 1);
  assert.equal(
    historyCreated.changeNote,
    'Corrected question text',
  );
});

// ==========================================
// HISTORY TESTS
// ==========================================

test('21 - Reject invalid history version', async () => {
  const service = createService({});

  await assert.rejects(
    service.getHistoryVersion(QUESTION_ID, 0),
    BadRequestException,
  );
});

test('22 - Reject history request for nonexistent question', async () => {
  const prisma = {
    question: {
      findFirst: async () => null,
    },
  };

  const service = createService(prisma);

  await assert.rejects(
    service.getHistory(QUESTION_ID),
    NotFoundException,
  );
});

test('23 - Return question history versions', async () => {
  const histories = [
    { version: 2 },
    { version: 1 },
  ];

  const prisma = {
    question: {
      findFirst: async () => ({
        id: QUESTION_ID,
        questionCode: 'Q-001',
      }),
    },
    questionHistory: {
      findMany: async () => histories,
    },
  };

  const service = createService(prisma);
  const result = await service.getHistory(QUESTION_ID);

  assert.equal(result.success, true);
  assert.equal(result.totalVersions, 2);
  assert.equal(result.data.length, 2);
});

// ==========================================
// SOFT DELETE / RECOVER TESTS
// ==========================================

test('24 - Soft delete an active question', async () => {
  let receivedData;

  const prisma = {
    question: {
      findFirst: async () => createExistingQuestion(),
      update: async (args) => {
        receivedData = args.data;
        return {
          id: QUESTION_ID,
          deletedAt: receivedData.deletedAt,
        };
      },
    },
  };

  const service = createService(prisma);
  const result = await service.softDelete(QUESTION_ID);

  assert.equal(result.success, true);
  assert.ok(receivedData.deletedAt instanceof Date);
});

test('25 - Return false when deleting nonexistent question', async () => {
  const prisma = {
    question: {
      findFirst: async () => null,
    },
  };

  const service = createService(prisma);
  const result = await service.softDelete(QUESTION_ID);

  assert.equal(result.success, false);
});

test('26 - Recover a deleted question', async () => {
  let receivedData;

  const prisma = {
    question: {
      findFirst: async () => ({
        ...createExistingQuestion(),
        deletedAt: new Date(),
      }),
      update: async (args) => {
        receivedData = args.data;
        return {
          id: QUESTION_ID,
          deletedAt: null,
        };
      },
    },
  };

  const service = createService(prisma);
  const result = await service.recover(QUESTION_ID);

  assert.equal(result.success, true);
  assert.equal(receivedData.deletedAt, null);
});

test('27 - Return false when recovering a non-deleted question', async () => {
  const prisma = {
    question: {
      findFirst: async () => null,
    },
  };

  const service = createService(prisma);
  const result = await service.recover(QUESTION_ID);

  assert.equal(result.success, false);
});

// ==========================================
// PERMANENT DELETE TESTS
// ==========================================

test('28 - Reject permanent deletion of an active question', async () => {
  const prisma = {
    $transaction: async (callback) =>
      callback({
        question: {
          findFirst: async () => null,
          findUnique: async () => ({
            id: QUESTION_ID,
            deletedAt: null,
          }),
        },
      }),
  };

  const service = createService(prisma);

  await assert.rejects(
    service.permanentDelete(QUESTION_ID),
    BadRequestException,
  );
});

test('29 - Reject permanent deletion of nonexistent question', async () => {
  const prisma = {
    $transaction: async (callback) =>
      callback({
        question: {
          findFirst: async () => null,
          findUnique: async () => null,
        },
      }),
  };

  const service = createService(prisma);

  await assert.rejects(
    service.permanentDelete(QUESTION_ID),
    NotFoundException,
  );
});

test('30 - Permanently delete a question from Trash', async () => {
  let detachedRows;
  let deletionWhere;

  const prisma = {
    $transaction: async (callback) =>
      callback({
        question: {
          findFirst: async () => ({
            id: QUESTION_ID,
            questionCode: 'Q-001',
            questionText: 'Deleted question',
            deletedAt: new Date(),
          }),
          deleteMany: async (args) => {
            deletionWhere = args.where;
            return { count: 1 };
          },
        },
        importRow: {
          updateMany: async () => {
            detachedRows = true;
            return { count: 2 };
          },
        },
      }),
  };

  const service = createService(prisma);
  const result = await service.permanentDelete(QUESTION_ID);

  assert.equal(detachedRows, true);
  assert.equal(deletionWhere.id, QUESTION_ID);
  assert.equal(result.success, true);
  assert.equal(result.data.permanentlyDeleted, true);
  assert.equal(result.data.detachedImportRows, 2);
});

test('31 - Reject permanent deletion when question is recovered during deletion', async () => {
  const prisma = {
    $transaction: async (callback) =>
      callback({
        question: {
          findFirst: async () => ({
            id: QUESTION_ID,
            questionCode: 'Q-001',
            questionText: 'Question',
            deletedAt: new Date(),
          }),
          deleteMany: async () => ({ count: 0 }),
        },
        importRow: {
          updateMany: async () => ({ count: 0 }),
        },
      }),
  };

  const service = createService(prisma);

  await assert.rejects(
    service.permanentDelete(QUESTION_ID),
    BadRequestException,
  );
});

// ==========================================
// UNIQUE CONSTRAINT ERROR TEST
// ==========================================

test('32 - Convert Prisma P2002 into ConflictException', async () => {
  const prisma = {
    $transaction: async () => {
      const error = new Error('Unique constraint failed');
      error.code = 'P2002';
      throw error;
    },
  };

  const service = createService(prisma);

  await assert.rejects(
    service.create({
      questionText: 'Test question',
      questionType: 'WRITTEN',
      subject: 'Math',
      topic: 'General',
      occurrences: [],
    }),
    ConflictException,
  );
});
