
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BadRequestException,
  ConflictException,
  NotFoundException,
} = require('@nestjs/common');

const {
  TopicsService,
} = require('../dist/modules/subjects/topics.service');

const SUBJECT_ID = '11111111-1111-4111-8111-111111111111';
const TOPIC_ID = '22222222-2222-4222-8222-222222222222';

test('01 - Public topic list returns active topics under active subjects', async () => {
  let receivedWhere;

  const prisma = {
    topic: {
      findMany: async (args) => {
        receivedWhere = args.where;
        return [
          {
            id: TOPIC_ID,
            name: 'ব্যাকরণ',
            isActive: true,
          },
        ];
      },
      count: async (args) => {
        receivedWhere = args.where;
        return 1;
      },
    },
    $transaction: async (operations) => Promise.all(operations),
  };

  const service = new TopicsService(prisma);
  const result = await service.findAll({});

  assert.equal(receivedWhere.isActive, true);
  assert.equal(receivedWhere.subject.isActive, true);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].isActive, true);
});

test('02 - Public topic list never returns inactive topics', async () => {
  let databaseCalled = false;

  const prisma = {
    topic: {
      findMany: async () => {
        databaseCalled = true;
        return [];
      },
      count: async () => {
        databaseCalled = true;
        return 0;
      },
    },
    $transaction: async (operations) => Promise.all(operations),
  };

  const service = new TopicsService(prisma);
  const result = await service.findAll({ isActive: 'false' });

  assert.equal(databaseCalled, false);
  assert.equal(result.data.length, 0);
  assert.equal(result.pagination.total, 0);
});

test('03 - Topics under inactive subjects are excluded', async () => {
  let receivedWhere;

  const prisma = {
    topic: {
      findMany: async (args) => {
        receivedWhere = args.where;
        return [];
      },
      count: async (args) => {
        receivedWhere = args.where;
        return 0;
      },
    },
    $transaction: async (operations) => Promise.all(operations),
  };

  const service = new TopicsService(prisma);

  await service.findAll({
    subjectId: SUBJECT_ID,
  });

  assert.equal(receivedWhere.isActive, true);
  assert.equal(receivedWhere.subject.isActive, true);
});

test('04 - Public topic details reject inactive topics', async () => {
  const prisma = {
    topic: {
      findUnique: async () => ({
        id: TOPIC_ID,
        name: 'ব্যাকরণ',
        isActive: false,
        subject: {
          id: SUBJECT_ID,
          name: 'বাংলা',
          slug: 'bangla',
          isActive: true,
        },
        parent: null,
        children: [],
        _count: {
          children: 0,
          questions: 0,
        },
      }),
    },
  };

  const service = new TopicsService(prisma);

  await assert.rejects(
    service.findOne(TOPIC_ID),
    NotFoundException,
  );
});

test('05 - Reject invalid topic ID', async () => {
  const service = new TopicsService({});

  await assert.rejects(
    service.findOne('invalid-id'),
    BadRequestException,
  );
});

test('06 - Prevent creating topic under inactive subject', async () => {
  const prisma = {
    subject: {
      findUnique: async () => ({
        id: SUBJECT_ID,
        isActive: false,
      }),
    },
  };

  const service = new TopicsService(prisma);

  await assert.rejects(
    service.create({
      subjectId: SUBJECT_ID,
      name: 'ব্যাকরণ',
    }),
    BadRequestException,
  );
});

test('07 - Reject duplicate topic name in same subject', async () => {
  const prisma = {
    subject: {
      findUnique: async () => ({
        id: SUBJECT_ID,
        isActive: true,
      }),
    },
    topic: {
      findFirst: async () => ({
        id: TOPIC_ID,
        name: 'ব্যাকরণ',
      }),
    },
  };

  const service = new TopicsService(prisma);

  await assert.rejects(
    service.create({
      subjectId: SUBJECT_ID,
      name: 'ব্যাকরণ',
    }),
    ConflictException,
  );
});

test('08 - Reject invalid isActive filter', async () => {
  const service = new TopicsService({});

  await assert.rejects(
    service.findAll({ isActive: 'yes' }),
    BadRequestException,
  );
});

test('09 - Public topic details reject topics under inactive subjects', async () => {
  const prisma = {
    topic: {
      findUnique: async () => ({
        id: TOPIC_ID,
        name: 'ব্যাকরণ',
        isActive: true,
        subject: {
          id: SUBJECT_ID,
          name: 'বাংলা',
          slug: 'bangla',
          isActive: false,
        },
        parent: null,
        children: [],
        _count: {
          children: 0,
          questions: 0,
        },
      }),
    },
  };

  const service = new TopicsService(prisma);

  await assert.rejects(
    service.findOne(TOPIC_ID),
    NotFoundException,
  );
});
