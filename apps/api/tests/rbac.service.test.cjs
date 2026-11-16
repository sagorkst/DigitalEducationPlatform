const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} = require('@nestjs/common');

const {
  RbacService,
} = require('../dist/modules/rbac/rbac.service');

function prismaMock(overrides = {}) {
  return {
    role: {
      findMany: async () => [],
      findUnique: async () => null,
      create: async ({ data }) => ({ id: 'role-1', ...data }),
      delete: async () => ({}),
      ...overrides.role,
    },
    permission: {
      findMany: async () => [],
      findUnique: async () => null,
      create: async ({ data }) => ({ id: 'permission-1', ...data }),
      ...overrides.permission,
    },
    rolePermission: {
      create: async () => ({}),
      deleteMany: async () => ({ count: 1 }),
      ...overrides.rolePermission,
    },
    user: {
      findFirst: async () => ({
        id: 'user-1',
      }),
      ...overrides.user,
    },
    userRole: {
      create: async () => ({}),
      deleteMany: async () => ({ count: 1 }),
      ...overrides.userRole,
    },
  };
}

function service(overrides = {}) {
  return new RbacService(prismaMock(overrides));
}

function prismaError(code) {
  const error = new Error('Prisma error');
  error.code = code;
  return error;
}

test('01 - List roles', async () => {
  const expected = [{ id: 'role-1', name: 'EDITOR' }];
  const rbac = service({
    role: { findMany: async () => expected },
  });

  assert.deepEqual(await rbac.listRoles(), expected);
});

test('02 - Create role successfully', async () => {
  const rbac = service();

  const result = await rbac.createRole({
    name: ' EDITOR ',
    description: ' Editor role ',
  });

  assert.equal(result.name, 'EDITOR');
  assert.equal(result.description, 'Editor role');
});

test('03 - Reject duplicate role', async () => {
  const rbac = service({
    role: {
      findUnique: async () => ({ id: 'role-1', name: 'EDITOR' }),
    },
  });

  await assert.rejects(
    rbac.createRole({ name: 'EDITOR' }),
    ConflictException,
  );
});

test('04 - Reject empty role name', async () => {
  const rbac = service();

  await assert.rejects(
    rbac.createRole({ name: '   ' }),
    BadRequestException,
  );
});

test('05 - Reject deletion of missing role', async () => {
  const rbac = service();

  await assert.rejects(
    rbac.deleteRole('role-1'),
    NotFoundException,
  );
});

test('06 - Protect SUPER_ADMIN role from deletion', async () => {
  const rbac = service({
    role: {
      findUnique: async () => ({
        id: 'role-1',
        name: 'SUPER_ADMIN',
        _count: { userRoles: 0, memberships: 0 },
      }),
    },
  });

  await assert.rejects(
    rbac.deleteRole('role-1'),
    ForbiddenException,
  );
});

test('07 - Prevent deletion of a role assigned to users', async () => {
  const rbac = service({
    role: {
      findUnique: async () => ({
        id: 'role-1',
        name: 'EDITOR',
        _count: { userRoles: 2, memberships: 0 },
      }),
    },
  });

  await assert.rejects(
    rbac.deleteRole('role-1'),
    ConflictException,
  );
});

test('08 - Delete unused role successfully', async () => {
  const rbac = service({
    role: {
      findUnique: async () => ({
        id: 'role-1',
        name: 'EDITOR',
        _count: { userRoles: 0, memberships: 0 },
      }),
    },
  });

  const result = await rbac.deleteRole('role-1');

  assert.equal(result.success, true);
});

test('09 - Create permission successfully', async () => {
  const rbac = service();

  const result = await rbac.createPermission({
    key: 'questions.create',
    description: 'Create questions',
  });

  assert.equal(result.key, 'questions.create');
});

test('10 - Reject duplicate permission', async () => {
  const rbac = service({
    permission: {
      findUnique: async () => ({
        id: 'permission-1',
        key: 'questions.create',
      }),
    },
  });

  await assert.rejects(
    rbac.createPermission({ key: 'questions.create' }),
    ConflictException,
  );
});

test('11 - Assign permission successfully', async () => {
  const rbac = service({
    role: {
      findUnique: async () => ({ id: 'role-1' }),
    },
    permission: {
      findUnique: async () => ({ id: 'permission-1' }),
    },
  });

  const result = await rbac.assignPermission(
    'role-1',
    'permission-1',
  );

  assert.equal(result.success, true);
});

test('12 - Reject duplicate permission assignment', async () => {
  const rbac = service({
    role: {
      findUnique: async () => ({ id: 'role-1' }),
    },
    permission: {
      findUnique: async () => ({ id: 'permission-1' }),
    },
    rolePermission: {
      create: async () => {
        throw prismaError('P2002');
      },
    },
  });

  await assert.rejects(
    rbac.assignPermission('role-1', 'permission-1'),
    ConflictException,
  );
});

test('13 - Reject permission assignment when role does not exist', async () => {
  const rbac = service();

  await assert.rejects(
    rbac.assignPermission('role-1', 'permission-1'),
    NotFoundException,
  );
});

test('14 - Remove permission successfully', async () => {
  const rbac = service({
    role: {
      findUnique: async () => ({ id: 'role-1', name: 'EDITOR' }),
    },
  });

  const result = await rbac.removePermission(
    'role-1',
    'permission-1',
  );

  assert.equal(result.success, true);
});

test('15 - Reject removal of missing permission relation', async () => {
  const rbac = service({
    role: {
      findUnique: async () => ({ id: 'role-1', name: 'EDITOR' }),
    },
    rolePermission: {
      deleteMany: async () => ({ count: 0 }),
    },
  });

  await assert.rejects(
    rbac.removePermission('role-1', 'permission-1'),
    NotFoundException,
  );
});

test('16 - Assign role to active user', async () => {
  const rbac = service({
    role: {
      findUnique: async () => ({
        id: 'role-1',
        name: 'STUDENT',
      }),
    },
  });

  const result = await rbac.assignRole('user-1', 'role-1');

  assert.equal(result.success, true);
});

test('17 - Reject role assignment to inactive user', async () => {
  const rbac = service({
    user: {
      findFirst: async () => null,
    },
    role: {
      findUnique: async () => ({
        id: 'role-1',
        name: 'STUDENT',
      }),
    },
  });

  await assert.rejects(
    rbac.assignRole('user-1', 'role-1'),
    NotFoundException,
  );
});

test('18 - Reject role assignment to deleted user', async () => {
  const rbac = service({
    user: {
      findFirst: async () => null,
    },
  });

  await assert.rejects(
    rbac.assignRole('deleted-user', 'role-1'),
    NotFoundException,
  );
});

test('19 - Protect SUPER_ADMIN from normal assignment', async () => {
  const rbac = service({
    role: {
      findUnique: async () => ({
        id: 'role-1',
        name: 'SUPER_ADMIN',
      }),
    },
  });

  await assert.rejects(
    rbac.assignRole('user-1', 'role-1'),
    ForbiddenException,
  );
});

test('20 - Reject duplicate user role assignment', async () => {
  const rbac = service({
    role: {
      findUnique: async () => ({
        id: 'role-1',
        name: 'STUDENT',
      }),
    },
    userRole: {
      create: async () => {
        throw prismaError('P2002');
      },
    },
  });

  await assert.rejects(
    rbac.assignRole('user-1', 'role-1'),
    ConflictException,
  );
});

test('21 - Remove role from user successfully', async () => {
  const rbac = service({
    role: {
      findUnique: async () => ({
        id: 'role-1',
        name: 'STUDENT',
      }),
    },
  });

  const result = await rbac.removeRole('user-1', 'role-1');

  assert.equal(result.success, true);
});

test('22 - Protect SUPER_ADMIN from normal removal', async () => {
  const rbac = service({
    role: {
      findUnique: async () => ({
        id: 'role-1',
        name: 'SUPER_ADMIN',
      }),
    },
  });

  await assert.rejects(
    rbac.removeRole('user-1', 'role-1'),
    ForbiddenException,
  );
});

test('23 - Reject removal of missing user role', async () => {
  const rbac = service({
    role: {
      findUnique: async () => ({
        id: 'role-1',
        name: 'STUDENT',
      }),
    },
    userRole: {
      deleteMany: async () => ({ count: 0 }),
    },
  });

  await assert.rejects(
    rbac.removeRole('user-1', 'role-1'),
    NotFoundException,
  );
});

test('24 - Reject role assignment when role does not exist', async () => {
  const rbac = service();

  await assert.rejects(
    rbac.assignRole('user-1', 'missing-role'),
    NotFoundException,
  );
});

test('25 - Reject creation of reserved SUPER_ADMIN role', async () => {
  const rbac = service();

  await assert.rejects(
    rbac.createRole({ name: 'SUPER_ADMIN' }),
    ForbiddenException,
  );
});

test('26 - Protect SUPER_ADMIN permissions from assignment changes', async () => {
  const rbac = service({
    role: {
      findUnique: async () => ({
        id: 'role-1',
        name: 'SUPER_ADMIN',
      }),
    },
    permission: {
      findUnique: async () => ({
        id: 'permission-1',
        key: 'questions.create',
      }),
    },
  });

  await assert.rejects(
    rbac.assignPermission('role-1', 'permission-1'),
    ForbiddenException,
  );
});

test('27 - Protect SUPER_ADMIN permissions from removal', async () => {
  const rbac = service({
    role: {
      findUnique: async () => ({
        id: 'role-1',
        name: 'SUPER_ADMIN',
      }),
    },
  });

  await assert.rejects(
    rbac.removePermission('role-1', 'permission-1'),
    ForbiddenException,
  );
});