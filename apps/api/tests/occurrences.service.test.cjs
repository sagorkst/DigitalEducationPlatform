const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BadRequestException,
  ConflictException,
  NotFoundException,
} = require('@nestjs/common');

const {
  OccurrencesService,
} = require('../dist/modules/occurrences/occurrences.service');

const QUESTION_ID = 'question-001';
const OCCURRENCE_ID = 'occurrence-001';

function createQuestion() {
  return {
    id: QUESTION_ID,
    questionCode: 'Q-001',
    questionText: 'Test question?',
    status: 'VERIFIED',
  };
}

function createOccurrence(overrides = {}) {
  return {
    id: OCCURRENCE_ID,
    questionId: QUESTION_ID,
    institution: 'Bangladesh Public Service Commission',
    examName: 'BCS Preliminary',
    examYear: 2025,
    postName: 'Assistant Director',
    department: null,
    questionNumber: null,
    source: null,
    sourcePage: null,
    sourceUrl: null,
    institutionId: null,
    examId: null,
    postId: null,
    sourceDocumentId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function createExam(overrides = {}) {
  return {
    id: 'exam-001',
    name: 'BCS Preliminary',
    examYear: 2025,
    institutionId: 'institution-001',
    postId: null,
    ...overrides,
  };
}

function createInstitution(overrides = {}) {
  return {
    id: 'institution-001',
    name: 'Bangladesh Public Service Commission',
    isActive: true,
    ...overrides,
  };
}

function createPost(overrides = {}) {
  return {
    id: 'post-001',
    name: 'Assistant Director',
    ...overrides,
  };
}

function createPrisma(overrides = {}) {
  const prisma = {
    question: {
      findFirst: async () => createQuestion(),
      ...overrides.question,
    },

    exam: {
      findUnique: async () => createExam(),
      ...overrides.exam,
    },

    institution: {
      findUnique: async () => createInstitution(),
      ...overrides.institution,
    },

    post: {
      findUnique: async () => createPost(),
      ...overrides.post,
    },

    sourceDocument: {
      findUnique: async () => ({
        id: 'document-001',
        title: 'BCS Question Paper',
      }),
      ...overrides.sourceDocument,
    },

    questionOccurrence: {
      findFirst: async () => null,
      findMany: async () => [],
      findUnique: async () => createOccurrence(),
      count: async () => 0,
      create: async ({ data }) => createOccurrence(data),
      update: async ({ data }) => createOccurrence(data),
      delete: async () => createOccurrence(),
      ...overrides.questionOccurrence,
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
  const service = new OccurrencesService(prisma);

  return { service, prisma };
}

function p2002Error() {
  return {
    code: 'P2002',
    message: 'Unique constraint failed',
  };
}

const legacyDto = {
  institution: 'Bangladesh Public Service Commission',
  examName: 'BCS Preliminary',
  examYear: 2025,
  postName: 'Assistant Director',
};

// =====================================================
// CREATE OCCURRENCE
// =====================================================

test('01 - creates occurrence successfully using legacy references', async () => {
  const { service, prisma } = createService();

  let createArgs;

  prisma.questionOccurrence.create = async (args) => {
    createArgs = args;
    return createOccurrence(args.data);
  };

  const result = await service.create(QUESTION_ID, legacyDto);

  assert.equal(result.success, true);
  assert.equal(
    result.message,
    'Question occurrence created successfully.',
  );
  assert.equal(createArgs.data.questionId, QUESTION_ID);
  assert.equal(
    createArgs.data.institution,
    legacyDto.institution,
  );
  assert.equal(createArgs.data.examName, legacyDto.examName);
  assert.equal(createArgs.data.examYear, 2025);
});

test('02 - creates occurrence using selected Exam and its references', async () => {
  const { service, prisma } = createService();

  let createArgs;

  prisma.questionOccurrence.create = async (args) => {
    createArgs = args;
    return createOccurrence(args.data);
  };

  const result = await service.create(QUESTION_ID, {
    examId: 'exam-001',
    institutionId: 'institution-001',
    postId: null,
    examYear: 2025,
  });

  assert.equal(result.success, true);
  assert.equal(createArgs.data.examId, 'exam-001');
  assert.equal(createArgs.data.institutionId, 'institution-001');
  assert.equal(
    createArgs.data.institution,
    'Bangladesh Public Service Commission',
  );
  assert.equal(createArgs.data.examName, 'BCS Preliminary');
});

test('03 - creates occurrence with post and source document references', async () => {
  const { service, prisma } = createService();

  let createArgs;

  prisma.questionOccurrence.create = async (args) => {
    createArgs = args;
    return createOccurrence(args.data);
  };

  await service.create(QUESTION_ID, {
    examId: 'exam-001',
    postId: null,
    institutionId: 'institution-001',
    examYear: 2025,
    sourceDocumentId: 'document-001',
    questionNumber: 10,
    sourcePage: 5,
    sourceUrl: 'https://example.com/paper.pdf',
  });

  assert.equal(createArgs.data.sourceDocumentId, 'document-001');
  assert.equal(createArgs.data.source, 'BCS Question Paper');
  assert.equal(createArgs.data.questionNumber, 10);
  assert.equal(createArgs.data.sourcePage, 5);
  assert.equal(
    createArgs.data.sourceUrl,
    'https://example.com/paper.pdf',
  );
});

test('04 - rejects occurrence for missing question', async () => {
  const { service, prisma } = createService({
    question: {
      findFirst: async () => null,
    },
  });

  await assert.rejects(
    service.create(QUESTION_ID, legacyDto),
    NotFoundException,
  );
});

test('05 - rejects missing selected Exam', async () => {
  const { service, prisma } = createService({
    exam: {
      findUnique: async () => null,
    },
  });

  await assert.rejects(
    service.create(QUESTION_ID, {
      examId: 'missing-exam',
      examYear: 2025,
    }),
    BadRequestException,
  );
});

test('06 - rejects Institution mismatch with selected Exam', async () => {
  const { service } = createService();

  await assert.rejects(
    service.create(QUESTION_ID, {
      examId: 'exam-001',
      institutionId: 'another-institution',
      examYear: 2025,
    }),
    BadRequestException,
  );
});

test('07 - rejects Post mismatch with selected Exam', async () => {
  const { service } = createService({
    exam: {
      findUnique: async () =>
        createExam({ postId: 'post-001' }),
    },
  });

  await assert.rejects(
    service.create(QUESTION_ID, {
      examId: 'exam-001',
      postId: 'another-post',
      examYear: 2025,
    }),
    BadRequestException,
  );
});

test('08 - rejects Exam Year mismatch', async () => {
  const { service } = createService();

  await assert.rejects(
    service.create(QUESTION_ID, {
      examId: 'exam-001',
      examYear: 2024,
    }),
    BadRequestException,
  );
});

test('09 - rejects missing selected Institution', async () => {
  const { service } = createService({
    institution: {
      findUnique: async () => null,
    },
  });

  await assert.rejects(
    service.create(QUESTION_ID, {
      institutionId: 'missing-institution',
      examName: 'BCS Preliminary',
      examYear: 2025,
    }),
    BadRequestException,
  );
});

test('10 - rejects inactive Institution', async () => {
  const { service } = createService({
    institution: {
      findUnique: async () =>
        createInstitution({ isActive: false }),
    },
  });

  await assert.rejects(
    service.create(QUESTION_ID, {
      institutionId: 'institution-001',
      examName: 'BCS Preliminary',
      examYear: 2025,
    }),
    BadRequestException,
  );
});

test('11 - rejects missing selected Post', async () => {
  const { service } = createService({
    post: {
      findUnique: async () => null,
    },
  });

  await assert.rejects(
    service.create(QUESTION_ID, {
      institution: 'Test Institution',
      examName: 'Test Exam',
      examYear: 2025,
      postId: 'missing-post',
    }),
    BadRequestException,
  );
});

test('12 - rejects missing Source Document', async () => {
  const { service } = createService({
    sourceDocument: {
      findUnique: async () => null,
    },
  });

  await assert.rejects(
    service.create(QUESTION_ID, {
      ...legacyDto,
      sourceDocumentId: 'missing-document',
    }),
    BadRequestException,
  );
});

test('13 - accepts occurrence with incomplete optional metadata', async () => {
  const { service, prisma } = createService();

  let createArgs;
  prisma.questionOccurrence.create = async (args) => {
    createArgs = args;
    return createOccurrence(args.data);
  };

  const result = await service.create(QUESTION_ID, {
    institution: '',
    examName: 'BCS Preliminary',
    examYear: 2025,
  });

  assert.equal(result.success, true);
  assert.equal(createArgs.data.institution, null);
  assert.equal(createArgs.data.examName, 'BCS Preliminary');
});

test('14 - rejects invalid Exam Year', async () => {
  const { service } = createService();

  await assert.rejects(
    service.create(QUESTION_ID, {
      institution: 'Test Institution',
      examName: 'Test Exam',
      examYear: 1800,
    }),
    BadRequestException,
  );
});

test('15 - rejects duplicate occurrence', async () => {
  const { service, prisma } = createService();
  prisma.questionOccurrence.findMany = async () => [
    createOccurrence({ id: 'existing-occurrence' }),
  ];

  await assert.rejects(
    service.create(QUESTION_ID, legacyDto),
    ConflictException,
  );
});

test('15b - detects duplicate identity despite case and whitespace differences', async () => {
  const { service, prisma } = createService();

  prisma.questionOccurrence.findMany = async () => [
    createOccurrence({
      id: 'normalized-duplicate',
      institution: '  bangladesh   public service commission ',
      examName: 'bcs   PRELIMINARY',
      postName: ' assistant   director ',
    }),
  ];

  await assert.rejects(
    service.create(QUESTION_ID, legacyDto),
    ConflictException,
  );
});

test('15c - allows a new occurrence when Exam Year differs', async () => {
  const { service, prisma } = createService();

  prisma.questionOccurrence.findMany = async () => [
    createOccurrence({ id: 'different-year', examYear: 2024 }),
  ];

  let createCalled = false;
  prisma.questionOccurrence.create = async ({ data }) => {
    createCalled = true;
    return createOccurrence(data);
  };

  const result = await service.create(QUESTION_ID, legacyDto);

  assert.equal(result.success, true);
  assert.equal(createCalled, true);
});

test('16 - converts Prisma P2002 into ConflictException', async () => {
  const { service, prisma } = createService();

  prisma.questionOccurrence.create = async () => {
    throw p2002Error();
  };

  await assert.rejects(
    service.create(QUESTION_ID, legacyDto),
    ConflictException,
  );
});

// =====================================================
// FIND OCCURRENCES BY QUESTION
// =====================================================

test('17 - returns all occurrences for a question', async () => {
  const { service, prisma } = createService();

  const occurrences = [
    createOccurrence(),
    createOccurrence({ id: 'occurrence-002', examYear: 2024 }),
  ];

  prisma.questionOccurrence.findMany = async () => occurrences;

  const result = await service.findAllByQuestion(QUESTION_ID);

  assert.equal(result.success, true);
  assert.equal(result.total, 2);
  assert.deepEqual(result.data, occurrences);
});

test('18 - rejects occurrence lookup for missing question', async () => {
  const { service, prisma } = createService();

  prisma.question.findFirst = async () => null;

  await assert.rejects(
    service.findAllByQuestion(QUESTION_ID),
    NotFoundException,
  );
});

// =====================================================
// FIND ALL OCCURRENCES
// =====================================================

test('19 - returns all occurrences with default pagination', async () => {
  const { service, prisma } = createService();

  const occurrences = [createOccurrence()];

  prisma.questionOccurrence.findMany = async () => occurrences;
  prisma.questionOccurrence.count = async () => 1;

  const result = await service.findAll({});

  assert.equal(result.success, true);
  assert.deepEqual(result.data, occurrences);
  assert.deepEqual(result.pagination, {
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  });
});

test('20 - applies all occurrence filters and search', async () => {
  const { service, prisma } = createService();

  let findManyArgs;

  prisma.questionOccurrence.findMany = async (args) => {
    findManyArgs = args;
    return [];
  };

  await service.findAll({
    questionId: QUESTION_ID,
    institutionId: 'institution-001',
    examId: 'exam-001',
    postId: 'post-001',
    examYear: 2025,
    search: '  BCS  ',
  });

  assert.equal(findManyArgs.where.questionId, QUESTION_ID);
  assert.equal(findManyArgs.where.institutionId, 'institution-001');
  assert.equal(findManyArgs.where.examId, 'exam-001');
  assert.equal(findManyArgs.where.postId, 'post-001');
  assert.equal(findManyArgs.where.examYear, 2025);

  assert.equal(findManyArgs.where.OR.length, 5);
  assert.deepEqual(findManyArgs.where.OR[0], {
    institution: {
      contains: 'BCS',
      mode: 'insensitive',
    },
  });
});

test('21 - applies occurrence pagination and calculates total pages', async () => {
  const { service, prisma } = createService();

  let findManyArgs;

  prisma.questionOccurrence.findMany = async (args) => {
    findManyArgs = args;
    return [];
  };

  prisma.questionOccurrence.count = async () => 45;

  const result = await service.findAll({
    page: 3,
    limit: 10,
  });

  assert.equal(findManyArgs.skip, 20);
  assert.equal(findManyArgs.take, 10);
  assert.equal(result.pagination.total, 45);
  assert.equal(result.pagination.totalPages, 5);
});

test('22 - enforces occurrence pagination limits', async () => {
  const { service, prisma } = createService();

  let findManyArgs;

  prisma.questionOccurrence.findMany = async (args) => {
    findManyArgs = args;
    return [];
  };

  await service.findAll({
    page: 0,
    limit: 500,
  });

  assert.equal(findManyArgs.skip, 0);
  assert.equal(findManyArgs.take, 100);
});

// =====================================================
// FIND ONE
// =====================================================

test('23 - returns a single occurrence', async () => {
  const { service, prisma } = createService();

  const occurrence = createOccurrence();

  prisma.questionOccurrence.findUnique = async () => occurrence;

  const result = await service.findOne(OCCURRENCE_ID);

  assert.equal(result.success, true);
  assert.equal(result.data, occurrence);
});

test('24 - throws NotFoundException for missing occurrence', async () => {
  const { service, prisma } = createService();

  prisma.questionOccurrence.findUnique = async () => null;

  await assert.rejects(
    service.findOne(OCCURRENCE_ID),
    NotFoundException,
  );
});

// =====================================================
// UPDATE OCCURRENCE
// =====================================================

test('25 - throws NotFoundException when updating missing occurrence', async () => {
  const { service, prisma } = createService();

  prisma.questionOccurrence.findUnique = async () => null;

  await assert.rejects(
    service.update(OCCURRENCE_ID, { department: 'Test' }),
    NotFoundException,
  );
});

test('26 - rejects empty occurrence update', async () => {
  const { service } = createService();

  await assert.rejects(
    service.update(OCCURRENCE_ID, {}),
    BadRequestException,
  );
});

test('27 - updates occurrence fields successfully', async () => {
  const { service, prisma } = createService();

  let updateArgs;

  prisma.questionOccurrence.findUnique = async () =>
    createOccurrence();

  prisma.questionOccurrence.update = async (args) => {
    updateArgs = args;
    return createOccurrence(args.data);
  };

  const result = await service.update(OCCURRENCE_ID, {
    department: 'Administration',
    questionNumber: 15,
    sourcePage: 8,
    sourceUrl: 'https://example.com/new.pdf',
  });

  assert.equal(result.success, true);
  assert.equal(
    result.message,
    'Question occurrence updated successfully.',
  );

  assert.equal(updateArgs.where.id, OCCURRENCE_ID);
  assert.equal(updateArgs.data.department, 'Administration');
  assert.equal(updateArgs.data.questionNumber, 15);
  assert.equal(updateArgs.data.sourcePage, 8);
  assert.equal(
    updateArgs.data.sourceUrl,
    'https://example.com/new.pdf',
  );
});

test('28 - rejects duplicate occurrence during update', async () => {
  const { service, prisma } = createService();

  prisma.questionOccurrence.findUnique = async () =>
    createOccurrence();

  prisma.questionOccurrence.findMany = async () => [
    createOccurrence({ id: 'another-occurrence' }),
  ];

  await assert.rejects(
    service.update(OCCURRENCE_ID, {
      questionNumber: 20,
    }),
    ConflictException,
  );
});

test('29 - excludes current occurrence from duplicate check', async () => {
  const { service, prisma } = createService();

  let duplicateArgs;

  prisma.questionOccurrence.findUnique = async () =>
    createOccurrence();

  prisma.questionOccurrence.findMany = async (args) => {
    duplicateArgs = args;
    return [createOccurrence({ id: OCCURRENCE_ID })];
  };

  prisma.questionOccurrence.update = async ({ data }) =>
    createOccurrence(data);

  await service.update(OCCURRENCE_ID, {
    questionNumber: 20,
  });

  assert.deepEqual(duplicateArgs.where, { questionId: QUESTION_ID });
});

test('30 - converts update P2002 into ConflictException', async () => {
  const { service, prisma } = createService();

  prisma.questionOccurrence.findUnique = async () =>
    createOccurrence();

  prisma.questionOccurrence.update = async () => {
    throw p2002Error();
  };

  await assert.rejects(
    service.update(OCCURRENCE_ID, {
      department: 'Updated Department',
    }),
    ConflictException,
  );
});

// =====================================================
// DELETE OCCURRENCE
// =====================================================

test('31 - throws NotFoundException when deleting missing occurrence', async () => {
  const { service, prisma } = createService();

  prisma.questionOccurrence.findUnique = async () => null;

  await assert.rejects(
    service.remove(OCCURRENCE_ID),
    NotFoundException,
  );
});

test('32 - deletes occurrence successfully', async () => {
  const { service, prisma } = createService();

  let deleteArgs;

  prisma.questionOccurrence.findUnique = async () => ({
    id: OCCURRENCE_ID,
  });

  prisma.questionOccurrence.delete = async (args) => {
    deleteArgs = args;
    return createOccurrence();
  };

  const result = await service.remove(OCCURRENCE_ID);

  assert.deepEqual(deleteArgs, {
    where: { id: OCCURRENCE_ID },
  });

  assert.equal(result.success, true);
  assert.equal(
    result.message,
    'Question occurrence deleted successfully.',
  );
});
test('15d - enriches a single yearless legacy occurrence when a Year is supplied', async () => {
  const { service, prisma } = createService();
  const existing = createOccurrence({
    id: 'yearless-occurrence',
    examYear: null,
    institutionId: null,
    examId: null,
    postId: null,
  });
  prisma.questionOccurrence.findMany = async () => [existing];

  let updateArgs;
  let createCalled = false;
  prisma.questionOccurrence.update = async (args) => {
    updateArgs = args;
    return createOccurrence({ ...existing, ...args.data });
  };
  prisma.questionOccurrence.create = async () => {
    createCalled = true;
    return createOccurrence();
  };

  const result = await service.create(QUESTION_ID, legacyDto);
  assert.equal(result.success, true);
  assert.equal(updateArgs.where.id, 'yearless-occurrence');
  assert.equal(updateArgs.data.examYear, 2025);
  assert.equal(createCalled, false);
});
