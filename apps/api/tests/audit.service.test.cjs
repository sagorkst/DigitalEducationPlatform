const test = require('node:test');
const assert = require('node:assert/strict');

const { AuditService } = require('../dist/modules/audit/audit.service');

test('01 - List audit logs with pagination', async () => {
  let findArgs;
  let countArgs;

  const prisma = {
    auditLog: {
      findMany: async (args) => {
        findArgs = args;
        return [
          {
            id: 'log-1',
            actorId: 'user-1',
            action: 'USER_STATUS_UPDATED',
            entityType: 'User',
            entityId: 'user-2',
            createdAt: new Date(),
            actor: { id: 'user-1', name: 'Admin' },
          },
        ];
      },
      count: async (args) => {
        countArgs = args;
        return 1;
      },
    },
  };

  const service = new AuditService(prisma);
  const result = await service.listAuditLogs({
    page: 1,
    limit: 20,
  });

  assert.equal(result.success, true);
  assert.equal(result.data.length, 1);
  assert.equal(result.pagination.total, 1);
  assert.equal(findArgs.skip, 0);
  assert.equal(findArgs.take, 20);
  assert.deepEqual(countArgs.where, {});
});

test('02 - Apply actor and action filters', async () => {
  let receivedWhere;

  const prisma = {
    auditLog: {
      findMany: async (args) => {
        receivedWhere = args.where;
        return [];
      },
      count: async () => 0,
    },
  };

  const service = new AuditService(prisma);

  await service.listAuditLogs({
    actorId: '11111111-1111-4111-8111-111111111111',
    action: 'LOGIN',
    page: 1,
    limit: 10,
  });

  assert.equal(
    receivedWhere.actorId,
    '11111111-1111-4111-8111-111111111111',
  );
  assert.equal(receivedWhere.action.contains, 'LOGIN');
  assert.equal(receivedWhere.action.mode, 'insensitive');
});

test('03 - Apply entity and date filters', async () => {
  let receivedWhere;

  const prisma = {
    auditLog: {
      findMany: async (args) => {
        receivedWhere = args.where;
        return [];
      },
      count: async () => 0,
    },
  };

  const service = new AuditService(prisma);

  await service.listAuditLogs({
    entityType: 'User',
    entityId: 'user-123',
    from: '2026-01-01T00:00:00.000Z',
    to: '2026-12-31T23:59:59.000Z',
    page: 1,
    limit: 20,
  });

  assert.equal(receivedWhere.entityType.contains, 'User');
  assert.equal(receivedWhere.entityId, 'user-123');
  assert.ok(receivedWhere.createdAt.gte instanceof Date);
  assert.ok(receivedWhere.createdAt.lte instanceof Date);
});

test('04 - Reject invalid date range', async () => {
  const prisma = {
    auditLog: {
      findMany: async () => [],
      count: async () => 0,
    },
  };

  const service = new AuditService(prisma);

  await assert.rejects(
    service.listAuditLogs({
      from: '2026-12-31T00:00:00.000Z',
      to: '2026-01-01T00:00:00.000Z',
      page: 1,
      limit: 20,
    }),
    (error) => error.status === 400,
  );
});

test('05 - Keep sensitive audit fields out of selected response', async () => {
  let select;

  const prisma = {
    auditLog: {
      findMany: async (args) => {
        select = args.select;
        return [];
      },
      count: async () => 0,
    },
  };

  const service = new AuditService(prisma);
  await service.listAuditLogs({ page: 1, limit: 20 });

  assert.equal(select.details, undefined);
  assert.equal(select.ipAddress, undefined);
  assert.equal(select.actor.select.name, true);
});
