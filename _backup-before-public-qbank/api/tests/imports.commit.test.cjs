
const test = require('node:test');
const assert = require('node:assert/strict');

const { ImportsService } = require('../dist/modules/imports/imports.service');

const validQuestion = {
  questionText: 'বাংলাদেশের রাজধানী কোনটি?',
  questionType: 'MCQ',
  subject: 'বাংলাদেশ বিষয়াবলি',
  topic: 'ভূগোল',
  difficulty: 'MEDIUM',
  status: 'DRAFT',
  correctAnswer: 'ঢাকা',
  explanation: 'ঢাকা বাংলাদেশের রাজধানী।',
  options: [
    { label: 'A', optionText: 'ঢাকা', isCorrect: true },
    { label: 'B', optionText: 'চট্টগ্রাম', isCorrect: false },
    { label: 'C', optionText: 'রাজশাহী', isCorrect: false },
    { label: 'D', optionText: 'খুলনা', isCorrect: false },
  ],
  occurrences: [
    {
      institution: 'বাংলাদেশ সরকারি কর্ম কমিশন',
      examName: 'BCS Preliminary',
      examYear: 2024,
      questionNumber: 1,
    },
  ],
};

function createRow(id = 'row-1', rawData = validQuestion) {
  return {
    id,
    batchId: 'batch-1',
    rowNumber: 1,
    status: 'VALID',
    rawData,
  };
}

function createHarness(options = {}) {
  const selectedRows = options.rows ?? [createRow()];
  const remainingValid = options.remainingValid ?? 0;

  const calls = {
    rowFindMany: [],
    questionCreate: [],
    rowUpdate: [],
    batchUpdate: [],
    batchStatus: [],
    rowCount: [],
  };

  const tx = {
    importBatch: {
      updateMany: async (args) => {
        calls.batchUpdate.push(args);
        calls.batchStatus.push(args.where.status);

        if (args.where.status === 'REVIEW') {
          return { count: options.claimCount ?? 1 };
        }

        return { count: options.finalUpdateCount ?? 1 };
      },

      findUnique: async () =>
        Object.prototype.hasOwnProperty.call(options, 'existingBatch')
          ? options.existingBatch
          : { id: 'batch-1' },

      findUniqueOrThrow: async () => ({
        id: 'batch-1',
        status: remainingValid > 0 ? 'REVIEW' : 'COMPLETED',
        importedRows: selectedRows.length,
      }),
    },

    importRow: {
      findMany: async (args) => {
        calls.rowFindMany.push(args);
        return selectedRows;
      },

      updateMany: async (args) => {
        calls.rowUpdate.push(args);
        return { count: 1 };
      },

      count: async () => {
        calls.rowCount.push(true);
        return remainingValid;
      },
    },

    question: {
      create: async (args) => {
        calls.questionCreate.push(args);

        if (options.questionCreateError) {
          throw options.questionCreateError;
        }

        return { id: 'question-created' };
      },
    },

    subject: {
      findFirst: async () => null,
    },

    topic: {
      findFirst: async () => null,
    },

    exam: {
      findUnique: async () => null,
    },
  };

  const prisma = {
    $transaction: async (callback) => {
      if (typeof callback === 'function') {
        return callback(tx);
      }

      return Promise.all(callback);
    },

    importRow: {
      updateMany: async (args) => {
        calls.rowUpdate.push(args);
        return { count: 1 };
      },

      count: async () => remainingValid,
    },
  };

  return {
    service: new ImportsService(prisma),
    calls,
  };
}

test('commit imports valid question with options and occurrences', async () => {
  const { service, calls } = createHarness();

  const result = await service.commit('batch-1');

  assert.equal(result.success, true);
  assert.equal(result.data.importedRows, 1);
  assert.equal(result.data.failedRows, 0);
  assert.equal(result.data.remainingValidRows, 0);

  assert.equal(calls.questionCreate.length, 1);

  const questionData = calls.questionCreate[0].data;

  assert.equal(questionData.questionText, validQuestion.questionText);
  assert.equal(questionData.options.create.length, 4);
  assert.equal(questionData.occurrences.create.length, 1);

  assert.equal(
    questionData.occurrences.create[0].examName,
    'BCS Preliminary',
  );

  assert.equal(calls.batchStatus[0], 'REVIEW');
  assert.equal(calls.batchStatus[1], 'PROCESSING');
});

test('commit marks failed question row as INVALID', async () => {
  const { service, calls } = createHarness({
    questionCreateError: new Error('Database creation failed'),
  });

  const result = await service.commit('batch-1');

  assert.equal(result.success, true);
  assert.equal(result.data.importedRows, 0);
  assert.equal(result.data.failedRows, 1);

  const failedUpdate = calls.rowUpdate.find(
    (item) => item.data.status === 'INVALID',
  );

  assert.ok(failedUpdate);

  assert.deepEqual(
    failedUpdate.data.errorMessages,
    ['Database creation failed'],
  );

  assert.equal(result.data.batch.status, 'COMPLETED');
});

test('commit keeps batch in REVIEW when valid rows remain', async () => {
  const { service } = createHarness({
    remainingValid: 2,
  });

  const result = await service.commit('batch-1');

  assert.equal(result.data.importedRows, 1);
  assert.equal(result.data.remainingValidRows, 2);
  assert.equal(result.data.batch.status, 'REVIEW');
});

test('commit processes only requested row IDs', async () => {
  const { service, calls } = createHarness({
    rows: [createRow('row-2')],
  });

  await service.commit('batch-1', ['row-2']);

  assert.deepEqual(
    calls.rowFindMany[0].where.id,
    { in: ['row-2'] },
  );
});

test('commit rejects batch that cannot be claimed', async () => {
  const { service } = createHarness({
    claimCount: 0,
  });

  await assert.rejects(
    () => service.commit('batch-1'),
    /not available for processing/i,
  );
});

test('commit rejects missing batch', async () => {
  const { service } = createHarness({
    claimCount: 0,
    existingBatch: null,
  });

  await assert.rejects(
    () => service.commit('batch-404'),
    /Import batch not found/i,
  );
});

test('commit rejects batch without valid rows', async () => {
  const { service } = createHarness({
    rows: [],
  });

  await assert.rejects(
    () => service.commit('batch-1'),
    /No valid rows available/i,
  );
});

test('commit records imported row and question ID', async () => {
  const { service, calls } = createHarness();

  await service.commit('batch-1');

  const importedUpdate = calls.rowUpdate.find(
    (item) => item.data.status === 'IMPORTED',
  );

  assert.ok(importedUpdate);
  assert.equal(importedUpdate.data.questionId, 'question-created');
});

test('commit rejects unexpected final batch update failure', async () => {
  const { service } = createHarness({
    finalUpdateCount: 0,
  });

  await assert.rejects(
    () => service.commit('batch-1'),
    /status changed unexpectedly/i,
  );
});
