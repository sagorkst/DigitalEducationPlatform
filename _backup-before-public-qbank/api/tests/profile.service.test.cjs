const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const { UsersService } = require('../dist/modules/users/users.service');

test('01 - Get own profile without password hash', async () => {
  const prisma = {
    user: {
      findFirst: async () => ({
        id: 'user-1',
        name: 'Student',
        status: 'ACTIVE',
        userRoles: [{ role: { id: 'r1', name: 'USER' } }],
      }),
    },
  };
  const result = await new UsersService(prisma).getMyProfile('user-1');
  assert.equal(result.data.id, 'user-1');
  assert.equal(result.data.roles[0].name, 'USER');
  assert.equal(result.data.passwordHash, undefined);
});

test('02 - Reject own profile when user is inactive or missing', async () => {
  const prisma = { user: { findFirst: async () => null } };
  await assert.rejects(
    new UsersService(prisma).getMyProfile('user-1'),
    (error) => error.status === 404,
  );
});

test('03 - Update own profile and reset email verification', async () => {
  let updateArgs;
  const prisma = {
    user: {
      findFirst: async () => ({
        id: 'user-1', email: 'old@example.com', phone: '01700000000',
      }),
      update: async (args) => {
        updateArgs = args;
        return { id: 'user-1', email: args.data.email };
      },
    },
  };
  const result = await new UsersService(prisma).updateMyProfile('user-1', {
    name: 'New Name',
    email: 'NEW@example.com',
  });
  assert.equal(updateArgs.data.name, 'New Name');
  assert.equal(updateArgs.data.email, 'new@example.com');
  assert.equal(updateArgs.data.emailVerified, false);
  assert.equal(result.success, true);
});

test('04 - Reject profile update when no fields are supplied', async () => {
  const prisma = {
    user: {
      findFirst: async () => ({
        id: 'user-1', email: 'a@example.com', phone: null,
      }),
    },
  };
  await assert.rejects(
    new UsersService(prisma).updateMyProfile('user-1', {}),
    (error) => error.status === 400,
  );
});

test('05 - Reject removal of the only contact method', async () => {
  const prisma = {
    user: {
      findFirst: async () => ({
        id: 'user-1', email: 'a@example.com', phone: null,
      }),
    },
  };
  await assert.rejects(
    new UsersService(prisma).updateMyProfile('user-1', { email: null }),
    (error) => error.status === 400,
  );
});

test('06 - Reject duplicate email or phone', async () => {
  const prisma = {
    user: {
      findFirst: async () => ({
        id: 'user-1', email: 'a@example.com', phone: null,
      }),
      update: async () => {
        const error = new Error('Unique constraint');
        error.code = 'P2002';
        throw error;
      },
    },
  };
  await assert.rejects(
    new UsersService(prisma).updateMyProfile('user-1', {
      email: 'taken@example.com',
    }),
    (error) => error.status === 409,
  );
});

test('07 - Change password after verifying current password', async () => {
  const oldHash = await bcrypt.hash('OldPassword123', 4);
  let savedHash;
  const prisma = {
    user: {
      findFirst: async () => ({
        id: 'user-1', passwordHash: oldHash,
      }),
      update: async (args) => {
        savedHash = args.data.passwordHash;
        return {};
      },
    },
  };
  const result = await new UsersService(prisma).changeMyPassword(
    'user-1', 'OldPassword123', 'NewPassword123',
  );
  assert.equal(await bcrypt.compare('NewPassword123', savedHash), true);
  assert.equal(result.success, true);
});

test('08 - Reject incorrect current password', async () => {
  const hash = await bcrypt.hash('CorrectPassword123', 4);
  const prisma = {
    user: {
      findFirst: async () => ({ id: 'user-1', passwordHash: hash }),
      update: async () => {
        throw new Error('Password must not update');
      },
    },
  };
  await assert.rejects(
    new UsersService(prisma).changeMyPassword(
      'user-1', 'WrongPassword123', 'NewPassword123',
    ),
    (error) => error.status === 401,
  );
});

test('09 - Reject reusing the current password', async () => {
  const hash = await bcrypt.hash('SamePassword123', 4);
  const prisma = {
    user: {
      findFirst: async () => ({ id: 'user-1', passwordHash: hash }),
      update: async () => {
        throw new Error('Password must not update');
      },
    },
  };
  await assert.rejects(
    new UsersService(prisma).changeMyPassword(
      'user-1', 'SamePassword123', 'SamePassword123',
    ),
    (error) => error.status === 400,
  );
});
