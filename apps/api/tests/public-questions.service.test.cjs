const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException, NotFoundException } = require('@nestjs/common');
const { PublicQuestionsService } = require('../dist/modules/public-question-bank/public-questions.service');

const ID = '11111111-1111-4111-8111-111111111111';

test('public listing always scopes to published and non-deleted questions', async () => {
  let args;
  const prisma = {
    question: {
      findMany: async (value) => { args = value; return []; },
      count: async () => 0,
    },
    $transaction: async (operations) => Promise.all(operations),
  };
  const service = new PublicQuestionsService(prisma);
  const result = await service.findAll({});
  assert.equal(args.where.status, 'PUBLISHED');
  assert.equal(args.where.deletedAt, null);
  assert.equal(args.take, 20);
  assert.equal(result.success, true);
});

test('public listing validates pagination and UUID filters', async () => {
  const service = new PublicQuestionsService({});
  await assert.rejects(service.findAll({ page: '0' }), BadRequestException);
  await assert.rejects(service.findAll({ limit: '101' }), BadRequestException);
  await assert.rejects(service.findAll({ subjectId: 'not-a-uuid' }), BadRequestException);
});

test('public detail only returns published non-deleted records and 404s otherwise', async () => {
  let where;
  const prisma = {
    question: { findFirst: async (args) => { where = args.where; return null; } },
  };
  const service = new PublicQuestionsService(prisma);
  await assert.rejects(service.findOne(ID), NotFoundException);
  assert.equal(where.status, 'PUBLISHED');
  assert.equal(where.deletedAt, null);
});

test('invalid public detail ID is rejected', async () => {
  const service = new PublicQuestionsService({});
  await assert.rejects(service.findOne('bad-id'), BadRequestException);
});


test('exam filter keeps identical exam names separated by exam year', async () => {
  let args;
  const prisma = {
    question: {
      findMany: async (value) => { args = value; return []; },
      count: async () => 0,
    },
    $transaction: async (operations) => Promise.all(operations),
  };
  const service = new PublicQuestionsService(prisma);
  await service.findAll({ exam: 'Primary Teacher', examYear: '2024' });
  const occurrenceFilter = args.where.AND.find((entry) => entry.occurrences?.some);
  assert.equal(occurrenceFilter.occurrences.some.examName.contains, 'Primary Teacher');
  assert.equal(occurrenceFilter.occurrences.some.examYear, 2024);
});


test('public listing filters by job grade and exam type on linked exam records', async () => {
  let args;
  const prisma = {
    question: {
      findMany: async (value) => { args = value; return []; },
      count: async () => 0,
    },
    $transaction: async (operations) => Promise.all(operations),
  };
  const service = new PublicQuestionsService(prisma);
  await service.findAll({ grade: '9th Grade', examType: 'WRITTEN' });
  const occurrenceFilter = args.where.AND.find((entry) => entry.occurrences?.some);
  assert.equal(occurrenceFilter.occurrences.some.examRef.grade.equals, '9th Grade');
  assert.equal(occurrenceFilter.occurrences.some.examRef.examType.equals, 'WRITTEN');
});

test('public listing filters questions by answer and explanation availability', async () => {
  let args;
  const prisma = {
    question: {
      findMany: async (value) => { args = value; return []; },
      count: async () => 0,
    },
    $transaction: async (operations) => Promise.all(operations),
  };
  const service = new PublicQuestionsService(prisma);
  await service.findAll({ hasAnswer: 'true', hasExplanation: 'false' });
  assert.ok(args.where.AND.some((entry) => Array.isArray(entry.OR) && entry.OR.some((item) => item.correctAnswer)));
  assert.ok(args.where.AND.some((entry) => entry.explanation === null));
});
