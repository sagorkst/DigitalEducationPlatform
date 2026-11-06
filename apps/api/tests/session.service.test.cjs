const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SessionService,
} = require('../dist/modules/auth/session.service');

function createMocks() {
  let capturedQuery;

  const prisma = {
    user: {
      updateMany: async (query) => {
        capturedQuery = query;
        return { count: 1 };
      },
    },
  };

  return {
    service: new SessionService(prisma),
    prisma,
    getCapturedQuery: () => capturedQuery,
  };
}

test('01 - Logout increments tokenVersion for active user', async () => {
  const {
    service,
    getCapturedQuery,
  } = createMocks();

  const result = await service.logout('active-user-id');

  assert.deepEqual(result, {
    success: true,
    message: 'Logout successful.',
  });

  const query = getCapturedQuery();

  assert.equal(query.where.id, 'active-user-id');
  assert.equal(query.where.status, 'ACTIVE');
  assert.equal(query.where.deletedAt, null);
  assert.deepEqual(query.data.tokenVersion, {
    increment: 1,
  });
});

test('02 - Logout rejects when active user is not found', async () => {
  const { service, prisma } = createMocks();

  prisma.user.updateMany = async () => ({
    count: 0,
  });

  await assert.rejects(
    () => service.logout('inactive-user-id'),
    (error) => error.status === 401,
  );
});

test('03 - Logout rejects when update affects multiple users', async () => {
  const { service, prisma } = createMocks();

  prisma.user.updateMany = async () => ({
    count: 2,
  });

  await assert.rejects(
    () => service.logout('active-user-id'),
    (error) => error.status === 401,
  );
});
