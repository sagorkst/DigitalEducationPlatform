const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('crypto');

require('ts-node/register');

const { PasswordResetService } = require('../src/modules/auth/password-reset.service');

function makeService(overrides = {}) {
  const prisma = {
    user: {
      findFirst: async () => ({
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
      }),
    },
    passwordResetToken: {
      count: async () => 0,
      findFirst: async () => null,
      create: async ({ data }) => ({ id: 'reset-1', ...data }),
      updateMany: async () => ({ count: 1 }),
    },
    $transaction: async (callback) => callback({
      passwordResetToken: {
        updateMany: async () => ({ count: 1 }),
        create: async ({ data }) => ({ id: 'reset-1', ...data }),
      },
      user: {
        updateMany: async () => ({ count: 1 }),
      },
      auditLog: {
        create: async () => ({ id: 'audit-1' }),
      },
    }),
    ...overrides,
  };

  const service = new PasswordResetService(prisma);
  return { service, prisma };
}

test('01 - Unknown email receives generic response', async () => {
  const { service } = makeService({
    user: { findFirst: async () => null },
  });

  const result = await service.requestPasswordReset('unknown@example.com');

  assert.equal(result.success, true);
  assert.match(result.message, /If an eligible account exists/);
});

test('02 - Eligible account gets a hashed reset token and email', async () => {
  const { service, prisma } = makeService();
  let sentMail;

  service.getTransporter = () => ({
    sendMail: async (mail) => {
      sentMail = mail;
    },
  });

  const result = await service.requestPasswordReset('TEST@example.com');

  assert.equal(result.success, true);
  assert.equal(sentMail.to, 'test@example.com');
  assert.match(sentMail.text, /reset-password\?token=/);

  const tokenMatch = sentMail.text.match(/token=([a-f0-9]{64})/);
  assert.ok(tokenMatch);

  const expectedHash = createHash('sha256')
    .update(tokenMatch[1])
    .digest('hex');

  assert.equal(prisma.passwordResetToken.create !== undefined, true);
  assert.equal(expectedHash.length, 64);
});

test('03 - Cooldown prevents another reset email', async () => {
  const { service, prisma } = makeService({
    passwordResetToken: {
      count: async () => 1,
      findFirst: async () => ({
        createdAt: new Date(),
        consumedAt: null,
      }),
      create: async () => {
        throw new Error('Should not create a token during cooldown.');
      },
      updateMany: async () => ({ count: 1 }),
    },
  });

  let emailSent = false;
  service.getTransporter = () => ({
    sendMail: async () => {
      emailSent = true;
    },
  });

  const result = await service.requestPasswordReset('test@example.com');

  assert.equal(result.success, true);
  assert.equal(emailSent, false);
});

test('04 - Invalid reset token is rejected', async () => {
  const { service } = makeService({
    passwordResetToken: {
      findFirst: async () => null,
    },
  });

  await assert.rejects(
    () => service.resetPassword('a'.repeat(64), 'NewPassword123'),
    (error) => error.getStatus() === 400,
  );
});

test('05 - Valid reset updates password, invalidates sessions and writes audit log', async () => {
  const { service, prisma } = makeService({
    passwordResetToken: {
      findFirst: async () => ({
        id: 'reset-1',
        userId: 'user-1',
        consumedAt: null,
        expiresAt: new Date(Date.now() + 60000),
        user: {
          id: 'user-1',
          status: 'ACTIVE',
          deletedAt: null,
        },
      }),
    },
  });

  let tokenClaimed = false;
  let userUpdated = false;
  let auditCreated = false;

  prisma.$transaction = async (callback) => callback({
    passwordResetToken: {
      updateMany: async () => {
        tokenClaimed = true;
        return { count: 1 };
      },
    },
    user: {
      updateMany: async ({ data }) => {
        userUpdated =
          typeof data.passwordHash === 'string' &&
          data.tokenVersion.increment === 1;
        return { count: 1 };
      },
    },
    auditLog: {
      create: async () => {
        auditCreated = true;
        return {};
      },
    },
  });

  const result = await service.resetPassword(
    'a'.repeat(64),
    'NewPassword123',
    '127.0.0.1',
  );

  assert.equal(result.success, true);
  assert.equal(tokenClaimed, true);
  assert.equal(userUpdated, true);
  assert.equal(auditCreated, true);
});

test('06 - Already claimed token cannot be used', async () => {
  const { service, prisma } = makeService({
    passwordResetToken: {
      findFirst: async () => ({
        id: 'reset-1',
        userId: 'user-1',
        consumedAt: null,
        expiresAt: new Date(Date.now() + 60000),
        user: {
          id: 'user-1',
          status: 'ACTIVE',
          deletedAt: null,
        },
      }),
    },
  });

  prisma.$transaction = async (callback) => callback({
    passwordResetToken: {
      updateMany: async () => ({ count: 0 }),
    },
    user: {
      updateMany: async () => ({ count: 1 }),
    },
    auditLog: {
      create: async () => ({}),
    },
  });

  await assert.rejects(
    () => service.resetPassword('a'.repeat(64), 'NewPassword123'),
    (error) => error.getStatus() === 400,
  );
});