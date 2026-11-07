
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BadRequestException,
  ConflictException,
  NotFoundException,
} = require('@nestjs/common');

const { ReviewsService } = require('../dist/modules/reviews/reviews.service');

function createMocks(options = {}) {
  const question = {
    findFirst: options.questionFindFirst ?? (async () => ({
      id: 'question-1',
      questionCode: 'Q-001',
      questionText: 'What is Bangladesh?',
      status: 'DRAFT',
    })),
    update: options.questionUpdate ?? (async ({ data }) => ({
      id: 'question-1',
      ...data,
    })),
  };

  const questionReview = {
    findFirst: options.reviewFindFirst ?? (async () => null),
    findUnique: options.reviewFindUnique ?? (async () => ({
      id: 'review-1',
      questionId: 'question-1',
      status: 'PENDING',
    })),
    create: options.reviewCreate ?? (async ({ data }) => ({
      id: 'review-1',
      ...data,
      status: 'PENDING',
    })),
    findMany: options.reviewFindMany ?? (async () => []),
    count: options.reviewCount ?? (async () => 0),
    updateMany: options.reviewUpdateMany ?? (async () => ({ count: 1 })),
  };

  const prisma = {
    question,
    questionReview,
    $transaction: async (arg) => {
      if (Array.isArray(arg)) return Promise.all(arg);

      return arg({ question, questionReview });
    },
  };

  return {
    service: new ReviewsService(prisma),
    prisma,
    question,
    questionReview,
  };
}

function isException(Type) {
  return (error) => error instanceof Type;
}

// SUBMIT

test('submit creates a pending review successfully', async () => {
  const { service } = createMocks();

  const result = await service.submit('question-1', {
    submissionNote: 'Please verify this question',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.id, 'review-1');
  assert.equal(result.data.submissionNote, 'Please verify this question');
});

test('submit trims submission note', async () => {
  let receivedData;

  const { service } = createMocks({
    reviewCreate: async ({ data }) => {
      receivedData = data;
      return { id: 'review-1', ...data };
    },
  });

  await service.submit('question-1', {
    submissionNote: '  Verify question  ',
  });

  assert.equal(receivedData.submissionNote, 'Verify question');
});

test('submit stores null when submission note is empty', async () => {
  let receivedData;

  const { service } = createMocks({
    reviewCreate: async ({ data }) => {
      receivedData = data;
      return { id: 'review-1', ...data };
    },
  });

  await service.submit('question-1', {
    submissionNote: '   ',
  });

  assert.equal(receivedData.submissionNote, null);
});

test('submit rejects missing question', async () => {
  const { service } = createMocks({
    questionFindFirst: async () => null,
  });

  await assert.rejects(
    service.submit('missing-question', {}),
    isException(NotFoundException),
  );
});

test('submit rejects archived question', async () => {
  const { service } = createMocks({
    questionFindFirst: async () => ({
      id: 'question-1',
      questionCode: 'Q-001',
      status: 'ARCHIVED',
    }),
  });

  await assert.rejects(
    service.submit('question-1', {}),
    isException(BadRequestException),
  );
});

test('submit rejects when a pending review already exists', async () => {
  const { service } = createMocks({
    reviewFindFirst: async () => ({
      id: 'existing-review',
      status: 'PENDING',
    }),
  });

  await assert.rejects(
    service.submit('question-1', {}),
    isException(ConflictException),
  );
});

// FIND ALL

test('findAll returns reviews with pagination', async () => {
  const reviews = [{ id: 'review-1' }];

  const { service } = createMocks({
    reviewFindMany: async () => reviews,
    reviewCount: async () => 21,
  });

  const result = await service.findAll({
    page: '2',
    limit: '10',
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.data, reviews);
  assert.equal(result.pagination.total, 21);
  assert.equal(result.pagination.page, 2);
  assert.equal(result.pagination.limit, 10);
  assert.equal(result.pagination.totalPages, 3);
});

test('findAll uses default pagination values', async () => {
  const { service } = createMocks();
  const result = await service.findAll({});

  assert.equal(result.pagination.page, 1);
  assert.equal(result.pagination.limit, 20);
});

test('findAll prevents page below one', async () => {
  const { service } = createMocks();

  const result = await service.findAll({
    page: '-5',
    limit: '10',
  });

  assert.equal(result.pagination.page, 1);
});

test('findAll limits maximum page size to 100', async () => {
  const { service } = createMocks();

  const result = await service.findAll({
    page: '1',
    limit: '500',
  });

  assert.equal(result.pagination.limit, 100);
});

test('findAll rejects invalid review status', async () => {
  const { service } = createMocks();

  await assert.rejects(
    service.findAll({ status: 'INVALID' }),
    isException(BadRequestException),
  );
});

test('findAll accepts valid review statuses', async () => {
  for (const status of ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']) {
    const { service } = createMocks();
    const result = await service.findAll({ status });

    assert.equal(result.success, true);
    assert.equal(result.filters.status, status);
  }
});

test('findAll applies question ID filter', async () => {
  let receivedWhere;

  const { service } = createMocks({
    reviewFindMany: async ({ where }) => {
      receivedWhere = where;
      return [];
    },
  });

  await service.findAll({ questionId: 'question-1' });

  assert.equal(receivedWhere.questionId, 'question-1');
});

test('findAll applies trimmed search filter', async () => {
  let receivedWhere;

  const { service } = createMocks({
    reviewFindMany: async ({ where }) => {
      receivedWhere = where;
      return [];
    },
  });

  const result = await service.findAll({
    search: '  Bangladesh  ',
  });

  assert.deepEqual(receivedWhere.question.OR, [
    {
      questionText: {
        contains: 'Bangladesh',
        mode: 'insensitive',
      },
    },
    {
      questionCode: {
        contains: 'Bangladesh',
        mode: 'insensitive',
      },
    },
  ]);

  assert.equal(result.filters.search, 'Bangladesh');
});

test('findAll returns null filters when filters are not supplied', async () => {
  const { service } = createMocks();
  const result = await service.findAll({});

  assert.deepEqual(result.filters, {
    status: null,
    questionId: null,
    search: null,
  });
});

// FIND ONE

test('findOne returns review details', async () => {
  const review = {
    id: 'review-1',
    questionId: 'question-1',
    status: 'PENDING',
    question: {
      id: 'question-1',
      options: [],
      occurrences: [],
    },
  };

  const { service } = createMocks({
    reviewFindUnique: async () => review,
  });

  const result = await service.findOne('review-1');

  assert.equal(result.success, true);
  assert.deepEqual(result.data, review);
});

test('findOne rejects missing review', async () => {
  const { service } = createMocks({
    reviewFindUnique: async () => null,
  });

  await assert.rejects(
    service.findOne('missing-review'),
    isException(NotFoundException),
  );
});

// QUESTION HISTORY

test('getQuestionHistory returns question and review history', async () => {
  const reviews = [
    { id: 'review-1', status: 'APPROVED' },
    { id: 'review-2', status: 'REJECTED' },
  ];

  const { service } = createMocks({
    reviewFindMany: async () => reviews,
  });

  const result = await service.getQuestionHistory('question-1');

  assert.equal(result.success, true);
  assert.equal(result.question.id, 'question-1');
  assert.equal(result.totalReviews, 2);
  assert.deepEqual(result.data, reviews);
});

test('getQuestionHistory rejects missing or deleted question', async () => {
  const { service } = createMocks({
    questionFindFirst: async () => null,
  });

  await assert.rejects(
    service.getQuestionHistory('missing-question'),
    isException(NotFoundException),
  );
});

// APPROVE

test('approve publishes question and approves review', async () => {
  let reviewUpdateData;
  let questionUpdateData;
  let findUniqueCalls = 0;

  const { service } = createMocks({
    reviewUpdateMany: async ({ data }) => {
      reviewUpdateData = data;
      return { count: 1 };
    },

    questionUpdate: async ({ data }) => {
      questionUpdateData = data;
      return { id: 'question-1', ...data };
    },

    reviewFindUnique: async () => {
      findUniqueCalls++;

      return {
        id: 'review-1',
        questionId: 'question-1',
        status: findUniqueCalls === 1 ? 'PENDING' : 'APPROVED',
      };
    },
  });

  const result = await service.approve('review-1');

  assert.equal(result.success, true);
  assert.equal(reviewUpdateData.status, 'APPROVED');
  assert.ok(reviewUpdateData.reviewedAt instanceof Date);
  assert.equal(questionUpdateData.status, 'PUBLISHED');
  assert.equal(result.data.status, 'APPROVED');
  assert.equal(findUniqueCalls, 2);
});

test('approve rejects missing review', async () => {
  const { service } = createMocks({
    reviewFindUnique: async () => null,
  });

  await assert.rejects(
    service.approve('missing-review'),
    isException(NotFoundException),
  );
});

test('approve rejects non-pending review', async () => {
  const { service } = createMocks({
    reviewFindUnique: async () => ({
      id: 'review-1',
      questionId: 'question-1',
      status: 'APPROVED',
    }),
  });

  await assert.rejects(
    service.approve('review-1'),
    isException(ConflictException),
  );
});

test('approve rejects missing or deleted question', async () => {
  const { service } = createMocks({
    questionFindFirst: async () => null,
  });

  await assert.rejects(
    service.approve('review-1'),
    isException(NotFoundException),
  );
});

test('approve rejects when review status changes concurrently', async () => {
  const { service } = createMocks({
    reviewUpdateMany: async () => ({ count: 0 }),
  });

  await assert.rejects(
    service.approve('review-1'),
    isException(ConflictException),
  );
});

// REJECT

test('reject updates review and returns question to draft', async () => {
  let reviewUpdateData;
  let questionUpdateData;
  let findUniqueCalls = 0;

  const { service } = createMocks({
    reviewUpdateMany: async ({ data }) => {
      reviewUpdateData = data;
      return { count: 1 };
    },

    questionUpdate: async ({ data }) => {
      questionUpdateData = data;
      return { id: 'question-1', ...data };
    },

    reviewFindUnique: async () => {
      findUniqueCalls++;

      return {
        id: 'review-1',
        questionId: 'question-1',
        status: findUniqueCalls === 1 ? 'PENDING' : 'REJECTED',
      };
    },
  });

  const result = await service.reject('review-1', 'Incorrect answer');

  assert.equal(result.success, true);
  assert.equal(reviewUpdateData.status, 'REJECTED');
  assert.equal(reviewUpdateData.reviewNote, 'Incorrect answer');
  assert.ok(reviewUpdateData.reviewedAt instanceof Date);
  assert.equal(questionUpdateData.status, 'DRAFT');
  assert.equal(result.data.status, 'REJECTED');
  assert.equal(findUniqueCalls, 2);
});

test('reject trims rejection reason', async () => {
  let receivedData;

  const { service } = createMocks({
    reviewUpdateMany: async ({ data }) => {
      receivedData = data;
      return { count: 1 };
    },
  });

  await service.reject('review-1', '  Wrong answer  ');

  assert.equal(receivedData.reviewNote, 'Wrong answer');
});

test('reject requires a rejection reason', async () => {
  const { service } = createMocks();

  await assert.rejects(
    service.reject('review-1', ''),
    isException(BadRequestException),
  );
});

test('reject requires at least three characters', async () => {
  const { service } = createMocks();

  await assert.rejects(
    service.reject('review-1', 'ab'),
    isException(BadRequestException),
  );
});

test('reject rejects missing review', async () => {
  const { service } = createMocks({
    reviewFindUnique: async () => null,
  });

  await assert.rejects(
    service.reject('missing-review', 'Invalid answer'),
    isException(NotFoundException),
  );
});

test('reject rejects non-pending review', async () => {
  const { service } = createMocks({
    reviewFindUnique: async () => ({
      id: 'review-1',
      questionId: 'question-1',
      status: 'REJECTED',
    }),
  });

  await assert.rejects(
    service.reject('review-1', 'Invalid answer'),
    isException(ConflictException),
  );
});

test('reject rejects missing or deleted question', async () => {
  const { service } = createMocks({
    questionFindFirst: async () => null,
  });

  await assert.rejects(
    service.reject('review-1', 'Invalid answer'),
    isException(NotFoundException),
  );
});

test('reject handles concurrent review status change', async () => {
  const { service } = createMocks({
    reviewUpdateMany: async () => ({ count: 0 }),
  });

  await assert.rejects(
    service.reject('review-1', 'Invalid answer'),
    isException(ConflictException),
  );
});

// CANCEL

test('cancel successfully cancels pending review', async () => {
  let receivedWhere;
  let receivedData;

  const { service } = createMocks({
    reviewUpdateMany: async ({ where, data }) => {
      receivedWhere = where;
      receivedData = data;
      return { count: 1 };
    },

    reviewFindUnique: async () => ({
      id: 'review-1',
      status: 'CANCELLED',
    }),
  });

  const result = await service.cancel('review-1');

  assert.equal(result.success, true);
  assert.deepEqual(receivedWhere, {
    id: 'review-1',
    status: 'PENDING',
  });
  assert.equal(receivedData.status, 'CANCELLED');
  assert.equal(result.data.status, 'CANCELLED');
});

test('cancel rejects missing review', async () => {
  const { service } = createMocks({
    reviewUpdateMany: async () => ({ count: 0 }),
    reviewFindUnique: async () => null,
  });

  await assert.rejects(
    service.cancel('missing-review'),
    isException(NotFoundException),
  );
});

test('cancel rejects non-pending review', async () => {
  const { service } = createMocks({
    reviewUpdateMany: async () => ({ count: 0 }),
    reviewFindUnique: async () => ({
      id: 'review-1',
      status: 'APPROVED',
    }),
  });

  await assert.rejects(
    service.cancel('review-1'),
    isException(ConflictException),
  );
});
