const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BadRequestException,
  ConflictException,
  NotFoundException,
} = require('@nestjs/common');

const {
  SubjectsService,
} = require('../dist/modules/subjects/subjects.service');

test('01 - Public subject list returns active subjects only', async () => {
  let receivedWhere;

  const prisma = {
    subject: {
      findMany: async (args) => {
        receivedWhere = args.where;
        return [{ id: 'subject-1', name: 'বাংলা', isActive: true }];
      },
      count: async (args) => {
        receivedWhere = args.where;
        return 1;
      },
    },
    $transaction: async (operations) => Promise.all(operations),
  };

  const service = new SubjectsService(prisma);
  const result = await service.findAll({});

  assert.equal(receivedWhere.isActive, true);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].isActive, true);
});

test('02 - Public subject list never returns inactive subjects', async () => {
  let databaseCalled = false;

  const prisma = {
    subject: {
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

  const service = new SubjectsService(prisma);
  const result = await service.findAll({ isActive: 'false' });

  assert.equal(databaseCalled, false);
  assert.equal(result.data.length, 0);
  assert.equal(result.pagination.total, 0);
});

test('03 - Public subject details reject inactive subjects', async () => {
  let receivedWhere;

  const prisma = {
    subject: {
      findFirst: async (args) => {
        receivedWhere = args.where;
        return null;
      },
    },
  };

  const service = new SubjectsService(prisma);

  await assert.rejects(
    service.findOne('11111111-1111-4111-8111-111111111111'),
    NotFoundException,
  );

  assert.equal(receivedWhere.isActive, true);
});

test('04 - Reject invalid subject ID', async () => {
  const service = new SubjectsService({});

  await assert.rejects(
    service.findOne('invalid-id'),
    BadRequestException,
  );
});

test('05 - Reject duplicate subject name', async () => {
  const prisma = {
    subject: {
      findFirst: async () => ({
        id: 'subject-1',
        name: 'বাংলা',
      }),
    },
  };

  const service = new SubjectsService(prisma);

  await assert.rejects(
    service.create({ name: ' বাংলা ' }),
    ConflictException,
  );
});

test('06 - Reject empty subject name', async () => {
  const service = new SubjectsService({});

  await assert.rejects(
    service.create({ name: '   ' }),
    BadRequestException,
  );
});

test('07 - Reject invalid isActive filter', async () => {
  const service = new SubjectsService({});

  await assert.rejects(
    service.findAll({ isActive: 'yes' }),
    BadRequestException,
  );
});

test('08 - Admin can reactivate an inactive subject', async () => {
  let receivedData;

  const prisma = {
    subject: {
      findUnique: async () => ({
        id: '11111111-1111-4111-8111-111111111111',
        name: 'বাংলা',
        isActive: false,
      }),
      update: async (args) => {
        receivedData = args.data;
        return {
          id: args.where.id,
          name: 'বাংলা',
          isActive: true,
          _count: { topics: 0, questions: 0 },
        };
      },
    },
  };

  const service = new SubjectsService(prisma);

  const result = await service.update(
    '11111111-1111-4111-8111-111111111111',
    { isActive: true },
  );

  assert.equal(receivedData.isActive, true);
  assert.equal(result.data.isActive, true);
});
