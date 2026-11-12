
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BadRequestException,
  ConflictException,
  NotFoundException,
} = require('@nestjs/common');

const {
  DuplicatesService,
} = require('../dist/modules/duplicates/duplicates.service');

const QUESTION_A_ID = '11111111-1111-4111-8111-111111111111';
const QUESTION_B_ID = '22222222-2222-4222-8222-222222222222';
const CANDIDATE_ID = '33333333-3333-4333-8333-333333333333';

const GROUP_1 = 'GROUP-1';
const GROUP_2 = 'GROUP-2';

function createMergeHarness(options = {}) {
  const {
    primaryGroupId = GROUP_1,
    secondaryGroupId = GROUP_2,
    candidateStatus = 'CONFIRMED',
    primaryQuestionId = QUESTION_A_ID,
  } = options;

  const secondaryQuestionId =
    primaryQuestionId === QUESTION_A_ID
      ? QUESTION_B_ID
      : QUESTION_A_ID;

  const primaryQuestion = {
    id: primaryQuestionId,
    repeatGroupId: primaryGroupId,
    deletedAt: null,
  };

  const secondaryQuestion = {
    id: secondaryQuestionId,
    repeatGroupId: secondaryGroupId,
    deletedAt: null,
  };

  const candidate = {
    id: CANDIDATE_ID,
    questionAId: QUESTION_A_ID,
    questionBId: QUESTION_B_ID,
    status: candidateStatus,
    reviewNote: null,
    reviewedBy: null,
    questionA: primaryQuestionId === QUESTION_A_ID
      ? primaryQuestion
      : secondaryQuestion,
    questionB: primaryQuestionId === QUESTION_A_ID
      ? secondaryQuestion
      : primaryQuestion,
  };

  const calls = {
    occurrenceUpdate: null,
    tagFind: null,
    tagCreate: null,
    tagDelete: null,
    groupUpdate: null,
    questionUpdates: [],
    candidateUpdate: null,
  };

  const tx = {
    duplicateCandidate: {
      findUnique: async () => candidate,

      update: async (args) => {
        calls.candidateUpdate = args;

        return {
          ...candidate,
          ...args.data,
        };
      },
    },

    question: {
      findFirst: async ({ where }) => {
        if (where.id === primaryQuestionId) {
          return primaryQuestion;
        }

        if (where.id === secondaryQuestionId) {
          return secondaryQuestion;
        }

        return null;
      },

      updateMany: async (args) => {
        calls.groupUpdate = args;

        return {
          count: 4,
        };
      },

      update: async (args) => {
        calls.questionUpdates.push(args);

        return {
          id: args.where.id,
          ...args.data,
        };
      },
    },

    questionOccurrence: {
      updateMany: async (args) => {
        calls.occurrenceUpdate = args;

        return {
          count: 3,
        };
      },
    },

    questionTagLink: {
      findMany: async (args) => {
        calls.tagFind = args;

        return [
          { tagId: 'TAG-1' },
          { tagId: 'TAG-2' },
        ];
      },

      createMany: async (args) => {
        calls.tagCreate = args;

        return {
          count: args.data.length,
        };
      },

      deleteMany: async (args) => {
        calls.tagDelete = args;

        return {
          count: 2,
        };
      },
    },
  };

  const prisma = {
    $transaction: async (callback) => callback(tx),
  };

  return {
    service: new DuplicatesService(prisma),
    calls,
    primaryQuestionId,
    secondaryQuestionId,
  };
}

// ==========================================
// TEST 01 - UNIFY TWO EXISTING REPEAT GROUPS
// ==========================================

test('01 - Merge unifies all members of both existing repeat groups', async () => {
  const {
    service,
    calls,
    primaryQuestionId,
    secondaryQuestionId,
  } = createMergeHarness({
    primaryGroupId: GROUP_1,
    secondaryGroupId: GROUP_2,
  });

  const result = await service.merge(CANDIDATE_ID, {
    primaryQuestionId,
  });

  assert.equal(
    calls.groupUpdate.where.repeatGroupId.in.includes(GROUP_1),
    true,
  );

  assert.equal(
    calls.groupUpdate.where.repeatGroupId.in.includes(GROUP_2),
    true,
  );

  assert.deepEqual(
    calls.groupUpdate.where.repeatGroupId.in.sort(),
    [GROUP_1, GROUP_2].sort(),
  );

  assert.equal(calls.groupUpdate.data.repeatGroupId, GROUP_1);

  assert.equal(result.data.repeatGroupId, GROUP_1);

  assert.equal(
    result.data.primaryQuestionId,
    primaryQuestionId,
  );

  assert.equal(
    result.data.secondaryQuestionId,
    secondaryQuestionId,
  );

  assert.equal(
    result.data.secondaryQuestionSoftDeleted,
    true,
  );

  assert.equal(
    calls.questionUpdates.length,
    2,
  );

  const secondaryUpdate = calls.questionUpdates.find(
    (item) => item.where.id === secondaryQuestionId,
  );

  assert.ok(secondaryUpdate);
  assert.ok(secondaryUpdate.data.deletedAt instanceof Date);
  assert.equal(secondaryUpdate.data.repeatGroupId, GROUP_1);

  assert.equal(
    result.data.movedOccurrences,
    3,
  );

  assert.equal(
    result.data.copiedTags,
    2,
  );
});

// ==========================================
// TEST 02 - REUSE SECONDARY GROUP
// ==========================================

test('02 - Merge reuses secondary repeat group when primary has no group', async () => {
  const {
    service,
    calls,
    primaryQuestionId,
  } = createMergeHarness({
    primaryGroupId: null,
    secondaryGroupId: GROUP_2,
  });

  const result = await service.merge(CANDIDATE_ID, {
    primaryQuestionId,
  });

  assert.equal(result.data.repeatGroupId, GROUP_2);

  assert.deepEqual(
    calls.groupUpdate.where.repeatGroupId.in,
    [GROUP_2],
  );

  assert.equal(
    calls.groupUpdate.data.repeatGroupId,
    GROUP_2,
  );

  assert.equal(
    calls.questionUpdates[0].data.repeatGroupId,
    GROUP_2,
  );

  assert.equal(
    calls.questionUpdates[1].data.repeatGroupId,
    GROUP_2,
  );
});

// ==========================================
// TEST 03 - GENERATE NEW REPEAT GROUP
// ==========================================

test('03 - Merge creates a new repeat group when both questions have no group', async () => {
  const {
    service,
    calls,
    primaryQuestionId,
  } = createMergeHarness({
    primaryGroupId: null,
    secondaryGroupId: null,
  });

  const result = await service.merge(CANDIDATE_ID, {
    primaryQuestionId,
  });

  const repeatGroupId = result.data.repeatGroupId;

  assert.equal(typeof repeatGroupId, 'string');

  assert.match(
    repeatGroupId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );

  assert.equal(calls.groupUpdate, null);

  assert.equal(
    calls.questionUpdates[0].data.repeatGroupId,
    repeatGroupId,
  );

  assert.equal(
    calls.questionUpdates[1].data.repeatGroupId,
    repeatGroupId,
  );
});

// ==========================================
// TEST 04 - REJECT UNCONFIRMED CANDIDATE
// ==========================================

test('04 - Reject merge when duplicate candidate is not confirmed', async () => {
  const { service } = createMergeHarness({
    candidateStatus: 'PENDING',
  });

  await assert.rejects(
    service.merge(CANDIDATE_ID, {
      primaryQuestionId: QUESTION_A_ID,
    }),
    ConflictException,
  );
});

// ==========================================
// TEST 05 - REJECT INVALID PRIMARY QUESTION
// ==========================================

test('05 - Reject primary question outside duplicate candidate', async () => {
  const { service } = createMergeHarness();

  await assert.rejects(
    service.merge(CANDIDATE_ID, {
      primaryQuestionId: '99999999-9999-4999-8999-999999999999',
    }),
    BadRequestException,
  );
});

// ==========================================
// TEST 06 - REJECT MISSING CANDIDATE
// ==========================================

test('06 - Reject merge when duplicate candidate does not exist', async () => {
  const prisma = {
    $transaction: async (callback) =>
      callback({
        duplicateCandidate: {
          findUnique: async () => null,
        },
      }),
  };

  const service = new DuplicatesService(prisma);

  await assert.rejects(
    service.merge(CANDIDATE_ID, {
      primaryQuestionId: QUESTION_A_ID,
    }),
    NotFoundException,
  );
});
