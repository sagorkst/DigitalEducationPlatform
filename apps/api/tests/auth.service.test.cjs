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
      create: async ({ data }) => ({
        id: 'new-user-id',
        name: data.name,
        email: data.email,
        phone: data.phone,
        accountType: data.accountType,
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
    signAsync: async () => 'test-registration-token',
    verifyAsync: async () => ({
      sub: 'new-user-id',
      email: 'test@example.com',
      purpose: 'registration_email_verification',
    }),
  };

  const verificationService = {
    requestRegistrationEmailVerification: async () => ({
      message: 'Verification code sent.',
      expiresInMinutes: 10,
      resendAfterSeconds: 60,
    }),
    verifyRegistrationEmail: async () => ({
      emailVerified: true,
      status: 'ACTIVE',
    }),
  };

  return {
    service: new AuthService(prisma, jwtService, verificationService),
    prisma,
    tx,
    jwtService,
    verificationService,
  };
}

function validRegistration(overrides = {}) {
  return {
    name: 'Test User',
    email: 'test@example.com',
    phone: '01700000000',
    accountType: 'GENERAL',
    password: 'Password123!',
    ...overrides,
  };
}

test('01 - Register creates PENDING user with USER role and sends OTP', async () => {
  const { service, tx } = createMocks();
  let capturedData;

  tx.user.create = async ({ data }) => {
    capturedData = data;

    return {
      id: 'new-user-id',
      name: data.name,
      email: data.email,
      phone: data.phone,
      accountType: data.accountType,
      status: data.status,
      createdAt: new Date(),
      userRoles: [{ role: { name: 'USER' } }],
    };
  };

  const result = await service.register(
    validRegistration({
      name: ' Test User ',
      email: 'TEST@EXAMPLE.COM',
      phone: ' 01700000000 ',
    }),
  );

  assert.equal(capturedData.name, 'Test User');
  assert.equal(capturedData.email, 'test@example.com');
  assert.equal(capturedData.phone, '01700000000');
  assert.equal(capturedData.accountType, 'GENERAL');
  assert.equal(capturedData.status, 'PENDING');
  assert.equal(capturedData.emailVerified, false);
  assert.equal(capturedData.userRoles.create.roleId, 'role-user-id');
  assert.deepEqual(result.data.roles, ['USER']);
  assert.equal(result.data.user.status, 'PENDING');
  assert.equal(result.data.otpSent, true);
  assert.equal(result.data.registrationToken, 'test-registration-token');
  assert.equal('passwordHash' in result.data.user, false);
});

test('02 - Registration rejects missing email and phone', async () => {
  const { service } = createMocks();

  await assert.rejects(
    () => service.register(validRegistration({ email: undefined })),
    (error) => error.status === 400,
  );

  await assert.rejects(
    () => service.register(validRegistration({ phone: undefined })),
    (error) => error.status === 400,
  );
});

test('03 - Registration rejects existing email', async () => {
  const { service, prisma } = createMocks();

  prisma.user.findUnique = async ({ where }) =>
    where.email ? { id: 'existing-user' } : null;

  await assert.rejects(
    () => service.register(validRegistration()),
    (error) => error.status === 409,
  );
});

test('04 - Registration rejects existing phone', async () => {
  const { service, prisma } = createMocks();

  prisma.user.findUnique = async ({ where }) =>
    where.phone ? { id: 'existing-user' } : null;

  await assert.rejects(
    () => service.register(validRegistration()),
    (error) => error.status === 409,
  );
});

test('05 - Registration fails safely when USER role is missing', async () => {
  const { service, tx } = createMocks();

  tx.role.findUnique = async () => null;

  await assert.rejects(
    () => service.register(validRegistration()),
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
      accountType: data.accountType,
      status: data.status,
      createdAt: new Date(),
      userRoles: [{ role: { name: 'USER' } }],
    };
  };

  await service.register(validRegistration());

  assert.equal(capturedData.userRoles.create.roleId, 'role-user-id');
  assert.equal(capturedData.userRoles.create.role, undefined);
});

test('07 - Pending account cannot login before email verification', async () => {
  const { service, prisma } = createMocks();
  const passwordHash = await bcrypt.hash('Password123!', 4);

  prisma.user.findFirst = async () => ({
    id: 'pending-user',
    email: 'test@example.com',
    phone: '01700000000',
    passwordHash,
    status: 'PENDING',
    deletedAt: null,
  });

  await assert.rejects(
    () => service.login({
      identifier: 'test@example.com',
      password: 'Password123!',
    }),
    (error) =>
      error.status === 403 &&
      error.message.includes('verify your email'),
  );
});

test('08 - Wrong password cannot login', async () => {
  const { service, prisma } = createMocks();
  const passwordHash = await bcrypt.hash('Password123!', 4);

  prisma.user.findFirst = async () => ({
    id: 'active-user',
    email: 'test@example.com',
    phone: '01700000000',
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
    name: 'Test User',
    email: 'test@example.com',
    phone: '01700000000',
    accountType: 'GENERAL',
    passwordHash,
    tokenVersion: 0,
    status: 'ACTIVE',
    deletedAt: null,
  });

  const result = await service.login({
    identifier: 'test@example.com',
    password: 'Password123!',
  });

  assert.equal(result.data.accessToken, 'test-registration-token');
  assert.equal(result.data.tokenType, 'Bearer');
  assert.equal(result.data.user.accountType, 'GENERAL');
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

test('11 - OTP delivery failure does not discard registration', async () => {
  const { service, verificationService } = createMocks();

  verificationService.requestRegistrationEmailVerification = async () => {
    throw new Error('SMTP unavailable');
  };

  const result = await service.register(validRegistration());

  assert.equal(result.success, true);
  assert.equal(result.data.otpSent, false);
  assert.equal(result.data.user.status, 'PENDING');
  assert.ok(result.data.registrationToken);
});

test('12 - Registration email verification activates the account', async () => {
  const { service } = createMocks();

  const result = await service.verifyRegistrationEmail(
    'test-registration-token',
    '123456',
    '127.0.0.1',
  );

  assert.equal(result.success, true);
  assert.equal(result.data.status, 'ACTIVE');
  assert.equal(result.data.emailVerified, true);
});

test('13 - Registration resend requires a pending account', async () => {
  const { service, prisma } = createMocks();

  prisma.user.findFirst = async () => ({
    id: 'new-user-id',
  });

  const result = await service.resendRegistrationVerification(
    'test-registration-token',
  );

  assert.equal(result.success, true);
  assert.equal(result.data.expiresInMinutes, 10);
  assert.equal(result.data.resendAfterSeconds, 60);
});
