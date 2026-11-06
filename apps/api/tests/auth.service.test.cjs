const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { AuthService } = require('../dist/modules/auth/auth.service');

function createMocks() {
  const tx = {
    role: {
      findUnique: async () => ({ id: 'role-user-id' }),
    },
    user: {
      create: async ({ data, select }) => ({
        id: 'new-user-id',
        name: data.name,
        email: data.email,
        phone: data.phone,
        status: data.status,
        createdAt: new Date(),
        userRoles: [{ role: { name: 'USER' } }],
      }),
    },
  };

  const prisma = {
    user: {
      findUnique: async () => null,
      findFirst: async () => null,
    },
    $transaction: async (callback) => callback(tx),
  };

  const jwtService = {
    signAsync: async () => 'test-access-token',
  };

  return {
    service: new AuthService(prisma, jwtService),
    prisma,
    tx,
  };
}

test('01 - Register creates PENDING user with USER role', async () => {
  const { service, prisma, tx } = createMocks();
  let capturedData;

  tx.user.create = async ({ data }) => {
    capturedData = data;

    return {
      id: 'new-user-id',
      name: data.name,
      email: data.email,
      phone: data.phone,
      status: data.status,
      createdAt: new Date(),
      userRoles: [{ role: { name: 'USER' } }],
    };
  };

  const result = await service.register({
    name: ' Test User ',
    email: 'TEST@EXAMPLE.COM',
    password: 'Password123!',
  });

  assert.equal(capturedData.name, 'Test User');
  assert.equal(capturedData.email, 'test@example.com');
  assert.equal(capturedData.status, 'PENDING');
  assert.equal(capturedData.userRoles.create.roleId, 'role-user-id');
  assert.deepEqual(result.data.roles, ['USER']);
  assert.equal(result.data.user.status, 'PENDING');
  assert.equal('passwordHash' in result.data.user, false);
});

test('02 - Registration rejects missing email and phone', async () => {
  const { service } = createMocks();

  await assert.rejects(
    () => service.register({
      name: 'Test User',
      password: 'Password123!',
    }),
    (error) => error.status === 400,
  );
});

test('03 - Registration rejects existing email', async () => {
  const { service, prisma } = createMocks();

  prisma.user.findUnique = async () => ({ id: 'existing-user' });

  await assert.rejects(
    () => service.register({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
    }),
    (error) => error.status === 409,
  );
});

test('04 - Registration rejects existing phone', async () => {
  const { service, prisma } = createMocks();

  prisma.user.findUnique = async () => ({ id: 'existing-user' });

  await assert.rejects(
    () => service.register({
      name: 'Test User',
      phone: '01700000000',
      password: 'Password123!',
    }),
    (error) => error.status === 409,
  );
});

test('05 - Registration fails safely when USER role is missing', async () => {
  const { service, tx } = createMocks();

  tx.role.findUnique = async () => null;

  await assert.rejects(
    () => service.register({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
    }),
    (error) => error.status === 500,
  );
});

test('06 - Registration never assigns administrative roles', async () => {
  const { service, tx } = createMocks();
  let capturedData;

  tx.user.create = async ({ data }) => {
    capturedData = data;

    return {
      id: 'new-user-id',
      name: data.name,
      email: data.email,
      phone: data.phone,
      status: data.status,
      createdAt: new Date(),
      userRoles: [{ role: { name: 'USER' } }],
    };
  };

  await service.register({
    name: 'Test User',
    email: 'test@example.com',
    password: 'Password123!',
  });

  assert.equal(capturedData.userRoles.create.roleId, 'role-user-id');
  assert.equal(capturedData.userRoles.create.role, undefined);
});

test('07 - Pending account cannot login', async () => {
  const { service, prisma } = createMocks();

  const passwordHash = await bcrypt.hash('Password123!', 4);

  prisma.user.findFirst = async () => ({
    id: 'pending-user',
    email: 'test@example.com',
    phone: null,
    passwordHash,
    status: 'PENDING',
    deletedAt: null,
  });

  await assert.rejects(
    () => service.login({
      identifier: 'test@example.com',
      password: 'Password123!',
    }),
    (error) => error.status === 403,
  );
});

test('08 - Wrong password cannot login', async () => {
  const { service, prisma } = createMocks();

  const passwordHash = await bcrypt.hash('Password123!', 4);

  prisma.user.findFirst = async () => ({
    id: 'active-user',
    email: 'test@example.com',
    phone: null,
    passwordHash,
    status: 'ACTIVE',
    deletedAt: null,
  });

  await assert.rejects(
    () => service.login({
      identifier: 'test@example.com',
      password: 'WrongPassword!',
    }),
    (error) => error.status === 401,
  );
});

test('09 - Active account login returns access token', async () => {
  const { service, prisma } = createMocks();

  const passwordHash = await bcrypt.hash('Password123!', 4);

  prisma.user.findFirst = async () => ({
    id: 'active-user',
    email: 'test@example.com',
    phone: null,
    passwordHash,
    status: 'ACTIVE',
    deletedAt: null,
  });

  const result = await service.login({
    identifier: 'test@example.com',
    password: 'Password123!',
  });

  assert.equal(result.data.accessToken, 'test-access-token');
  assert.equal(result.data.tokenType, 'Bearer');
});

test('10 - Deleted account cannot login', async () => {
  const { service, prisma } = createMocks();

  prisma.user.findFirst = async () => null;

  await assert.rejects(
    () => service.login({
      identifier: 'deleted@example.com',
      password: 'Password123!',
    }),
    (error) => error.status === 401,
  );
});