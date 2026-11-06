const test = require('node:test');
const assert = require('node:assert/strict');

const { UsersService } = require('../dist/modules/users/users.service');

test('01 - List users with pagination', async () => {
  const prisma = {
    user: {
      findMany: async () => [
        {
          id: 'user-1',
          name: 'Test User',
          userRoles: [{ role: { id: 'role-1', name: 'USER' } }],
        },
      ],
      count: async () => 1,
    },
  };

  const service = new UsersService(prisma);
  const result = await service.listUsers({ page: 1, limit: 20 });

  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].roles[0].name, 'USER');
  assert.equal(result.pagination.total, 1);
});

test('02 - Search and status filters are applied', async () => {
  let receivedWhere;

  const prisma = {
    user: {
      findMany: async (args) => {
        receivedWhere = args.where;
        return [];
      },
      count: async (args) => {
        receivedWhere = args.where;
        return 0;
      },
    },
  };

  const service = new UsersService(prisma);

  await service.listUsers({
    search: 'student',
    status: 'ACTIVE',
    page: 2,
    limit: 10,
  });

  assert.equal(receivedWhere.status, 'ACTIVE');
  assert.equal(receivedWhere.OR.length, 3);
  assert.equal(receivedWhere.deletedAt, null);
});

test('03 - Get user details', async () => {
  const prisma = {
    user: {
      findFirst: async () => ({
        id: 'user-1',
        name: 'Test User',
        userRoles: [{ role: { id: 'role-1', name: 'USER' } }],
      }),
    },
  };

  const service = new UsersService(prisma);
  const result = await service.getUserDetails('user-1');

  assert.equal(result.id, 'user-1');
  assert.equal(result.roles[0].name, 'USER');
});

test('04 - Reject missing user details', async () => {
  const prisma = {
    user: {
      findFirst: async () => null,
    },
  };

  const service = new UsersService(prisma);

  await assert.rejects(
    service.getUserDetails('missing'),
    (error) => error.status === 404,
  );
});

test('05 - Prevent changing own account status', async () => {
  const prisma = {
    $transaction: async () => {
      throw new Error('Transaction should not run.');
    },
  };

  const service = new UsersService(prisma);

  await assert.rejects(
    service.updateUserStatus(
      'user-1',
      'SUSPENDED',
      'user-1',
    ),
    (error) => error.status === 403,
  );
});

test('06 - Prevent changing SUPER_ADMIN status', async () => {
  const tx = {
    user: {
      findFirst: async () => ({
        id: 'admin-1',
        status: 'ACTIVE',
        userRoles: [{ role: { name: 'SUPER_ADMIN' } }],
      }),
    },
  };

  const prisma = {
    $transaction: async (callback) => callback(tx),
  };

  const service = new UsersService(prisma);

  await assert.rejects(
    service.updateUserStatus(
      'admin-1',
      'SUSPENDED',
      'actor-1',
    ),
    (error) => error.status === 403,
  );
});

test('07 - Update status and create audit log in one transaction', async () => {
  let updatedData;
  let auditData;

  const tx = {
    user: {
      findFirst: async () => ({
        id: 'user-1',
        status: 'ACTIVE',
        userRoles: [{ role: { name: 'USER' } }],
      }),
      update: async (args) => {
        updatedData = args.data;
        return {
          id: 'user-1',
          name: 'Test User',
          status: 'SUSPENDED',
        };
      },
    },
    auditLog: {
      create: async (args) => {
        auditData = args.data;
        return args.data;
      },
    },
  };

  const prisma = {
    $transaction: async (callback) => callback(tx),
  };

  const service = new UsersService(prisma);

  const result = await service.updateUserStatus(
    'user-1',
    'SUSPENDED',
    'admin-1',
    '127.0.0.1',
  );

  assert.equal(updatedData.status, 'SUSPENDED');
  assert.equal(auditData.actorId, 'admin-1');
  assert.equal(auditData.action, 'USER_STATUS_UPDATED');
  assert.equal(auditData.details.previousStatus, 'ACTIVE');
  assert.equal(auditData.details.newStatus, 'SUSPENDED');
  assert.equal(auditData.ipAddress, '127.0.0.1');
  assert.equal(result.success, true);
});

test('08 - Reject unchanged status', async () => {
  const tx = {
    user: {
      findFirst: async () => ({
        id: 'user-1',
        status: 'ACTIVE',
        userRoles: [{ role: { name: 'USER' } }],
      }),
    },
  };

  const prisma = {
    $transaction: async (callback) => callback(tx),
  };

  const service = new UsersService(prisma);

  await assert.rejects(
    service.updateUserStatus(
      'user-1',
      'ACTIVE',
      'admin-1',
    ),
    (error) => error.status === 400,
  );
});