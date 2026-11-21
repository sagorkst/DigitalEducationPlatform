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

test('filter options return live counts using unique published question IDs', async () => {
  const institutionId = '22222222-2222-4222-8222-222222222222';
  const examId = '33333333-3333-4333-8333-333333333333';
  const postId = '44444444-4444-4444-8444-444444444444';
  const topicId = '55555555-5555-4555-8555-555555555555';
  const q1 = '66666666-6666-4666-8666-666666666666';
  const q2 = '77777777-7777-4777-8777-777777777777';

  const prisma = {
    questionOccurrence: {
      findMany: async () => [
        { institution: 'Education Board', institutionId, examId, postId, postName: 'Assistant', examYear: 2024, questionId: q1 },
        { institution: 'Education Board', institutionId, examId, postId, postName: 'Assistant', examYear: 2024, questionId: q1 },
        { institution: 'Education Board', institutionId, examId, postId, postName: 'Assistant', examYear: 2024, questionId: q2 },
      ],
    },
    exam: {
      findMany: async () => [{
        id: examId,
        name: 'Recruitment Exam',
        examYear: 2024,
        examType: 'WRITTEN',
        grade: '9th Grade',
        institution: { id: institutionId, name: 'Education Board' },
        post: { id: postId, name: 'Assistant' },
      }],
    },
    topic: {
      findMany: async () => [{
        id: topicId,
        name: 'Grammar',
        subjectId: ID,
        parentId: null,
        subject: { name: 'English' },
        _count: { questions: 2 },
      }],
      count: async () => 1,
    },
    question: { count: async () => 2 },
    subject: { count: async () => 1 },
  };

  const result = await new PublicQuestionsService(prisma).filterOptions();
  assert.equal(result.data.summary.questions, 2);
  assert.equal(result.data.summary.exams, 1);
  assert.equal(result.data.summary.institutions, 1);
  assert.deepEqual(result.data.institutions, [{ id: institutionId, name: 'Education Board', count: 2 }]);
  assert.equal(result.data.exams[0].questionCount, 2);
  assert.deepEqual(result.data.posts, [{ id: postId, name: 'Assistant', count: 2 }]);
  assert.deepEqual(result.data.years, [{ year: 2024, count: 2 }]);
  assert.deepEqual(result.data.examTypes, [{ name: 'WRITTEN', count: 2 }]);
  assert.deepEqual(result.data.grades, [{ name: '9th Grade', count: 2 }]);
  assert.equal(result.data.topics[0].count, 2);
});
