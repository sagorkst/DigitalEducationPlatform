const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('crypto');

require('ts-node/register');

const { VerificationService } = require('../src/modules/users/verification.service');

process.env.JWT_SECRET = 'verification-test-secret-which-is-long-enough-123456';

function makePrisma(record, user) {
  const state = { record, user, audit: [], recentCount: 0 };

  const prisma = {
    user: {
      findFirst: async ({ where }) => {
        if (
          state.user &&
          state.user.id === where.id &&
          (where.status === undefined || state.user.status === where.status) &&
          state.user.deletedAt === null
        ) {
          return {
            id: state.user.id,
            name: state.user.name || 'Test User',
            email: state.user.email,
            emailVerified: state.user.emailVerified,
          };
        }
        return null;
      },
    },
    verificationCode: {
      count: async () => state.recentCount,
      findFirst: async ({ where } = {}) =>
        state.record &&
        !state.record.consumedAt &&
        (!where?.userId || state.record.userId === where.userId) &&
        (!where?.channel || state.record.channel === where.channel) &&
        (!where?.target || state.record.target === where.target)
          ? state.record
          : null,

      update: async ({ data }) => {
        if (data.attempts?.increment) {
          state.record.attempts += data.attempts.increment;
        }
        if (data.consumedAt) {
          state.record.consumedAt = data.consumedAt;
        }
        return state.record;
      },

      updateMany: async ({ data }) => {
        if (!state.record || state.record.consumedAt) {
          return { count: 0 };
        }
        Object.assign(state.record, data);
        return { count: 1 };
      },
    },

    $transaction: async (callback) =>
      callback({
        verificationCode: {
          updateMany: async ({ data }) => {
            if (!state.record || state.record.consumedAt) {
              return { count: 0 };
            }
            Object.assign(state.record, data);
            return { count: 1 };
          },
        },

        user: {
          findFirst: async ({ where }) => {
            if (
              state.user &&
              state.user.id === where.id &&
              state.user.email === where.email &&
              state.user.status === where.status &&
              state.user.deletedAt === null
            ) {
              return { id: state.user.id };
            }
            return null;
          },

          update: async ({ data }) => {
            Object.assign(state.user, data);
            return state.user;
          },
        },

        auditLog: {
          create: async ({ data }) => {
            state.audit.push(data);
            return data;
          },
        },
      }),
  };

  return { prisma, state };
}

function makeRecord(code = '123456', overrides = {}) {
  const codeHash = createHmac('sha256', process.env.JWT_SECRET)
    .update(code)
    .digest('hex');

  return {
    id: 'code-id',
    userId: 'user-id',
    channel: 'EMAIL',
    target: 'student@example.com',
    codeHash,
    attempts: 0,
    expiresAt: new Date(Date.now() + 600000),
    consumedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeUser() {
  return {
    id: 'user-id',
    email: 'student@example.com',
    emailVerified: false,
    status: 'ACTIVE',
    deletedAt: null,
  };
}

test('01 - Reject verification when no active code exists', async () => {
  const { prisma } = makePrisma(null, makeUser());
  const service = new VerificationService(prisma);

  await assert.rejects(
    service.verifyEmail('user-id', '123456'),
    { status: 404 },
  );
});

test('02 - Expired code is consumed and rejected', async () => {
  const record = makeRecord('123456', {
    expiresAt: new Date(Date.now() - 1000),
  });

  const { prisma, state } = makePrisma(record, makeUser());
  const service = new VerificationService(prisma);

  await assert.rejects(
    service.verifyEmail('user-id', '123456'),
    { status: 400 },
  );

  assert.ok(state.record.consumedAt);
});

test('03 - Wrong code increments attempts', async () => {
  const { prisma, state } = makePrisma(makeRecord(), makeUser());
  const service = new VerificationService(prisma);

  await assert.rejects(
    service.verifyEmail('user-id', '999999'),
    { status: 401 },
  );

  assert.equal(state.record.attempts, 1);
  assert.equal(state.record.consumedAt, null);
});

test('04 - Correct code verifies email and writes audit log', async () => {
  const { prisma, state } = makePrisma(makeRecord(), makeUser());
  const service = new VerificationService(prisma);

  const result = await service.verifyEmail(
    'user-id',
    '123456',
    '127.0.0.1',
  );

  assert.equal(state.user.emailVerified, true);
  assert.ok(state.record.consumedAt);
  assert.equal(state.audit.length, 1);
  assert.equal(state.audit[0].action, 'EMAIL_VERIFIED');
  assert.equal(result.message, 'Email successfully verified.');
});

test('05 - Rejects a code when the email address has changed', async () => {
  const user = makeUser();
  user.email = 'changed@example.com';

  const { prisma, state } = makePrisma(makeRecord(), user);
  const service = new VerificationService(prisma);

  await assert.rejects(
    service.verifyEmail('user-id', '123456'),
    { status: 404 },
  );

  assert.equal(state.user.emailVerified, false);
  assert.equal(state.audit.length, 0);
  assert.equal(state.record.consumedAt, null);
});

test('06 - Fifth wrong attempt consumes the verification code', async () => {
  const { prisma, state } = makePrisma(makeRecord(), makeUser());
  const service = new VerificationService(prisma);

  for (let i = 1; i <= 5; i++) {
    await assert.rejects(
      service.verifyEmail('user-id', '999999'),
      { status: 401 },
    );
    assert.equal(state.record.attempts, i);
  }

  assert.ok(state.record.consumedAt);
});

test('07 - Code with five previous attempts is rejected with 429', async () => {
  const record = makeRecord('123456', { attempts: 5 });
  const { prisma, state } = makePrisma(record, makeUser());
  const service = new VerificationService(prisma);

  await assert.rejects(
    service.verifyEmail('user-id', '123456'),
    { status: 429 },
  );

  assert.ok(state.record.consumedAt);
  assert.equal(state.user.emailVerified, false);
});

test('08 - Successfully used OTP cannot be reused', async () => {
  const { prisma, state } = makePrisma(makeRecord(), makeUser());
  const service = new VerificationService(prisma);

  await service.verifyEmail('user-id', '123456');

  await assert.rejects(
    service.verifyEmail('user-id', '123456'),
    { status: 404 },
  );

  assert.equal(state.audit.length, 1);
});

test('09 - Expired OTP cannot be reused', async () => {
  const record = makeRecord('123456', {
    expiresAt: new Date(Date.now() - 1000),
  });

  const { prisma } = makePrisma(record, makeUser());
  const service = new VerificationService(prisma);

  await assert.rejects(
    service.verifyEmail('user-id', '123456'),
    { status: 400 },
  );

  await assert.rejects(
    service.verifyEmail('user-id', '123456'),
    { status: 404 },
  );
});
test('10 - Resend request is blocked during the 60-second cooldown', async () => {
  const record = makeRecord();
  const { prisma, state } = makePrisma(record, makeUser());
  state.recentCount = 1;

  const service = new VerificationService(prisma);

  await assert.rejects(
    service.requestEmailVerification('user-id'),
    { status: 429 },
  );
});

test('11 - Sixth request within one hour is blocked', async () => {
  const { prisma, state } = makePrisma(null, makeUser());
  state.recentCount = 5;

  const service = new VerificationService(prisma);

  await assert.rejects(
    service.requestEmailVerification('user-id'),
    { status: 429 },
  );
});
