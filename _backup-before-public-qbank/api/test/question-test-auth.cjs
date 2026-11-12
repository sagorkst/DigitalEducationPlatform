
const supertest = require('supertest');
const { JwtService } = require('@nestjs/jwt');

let accessToken = null;

const protectedMethods = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
]);

function request(server) {
  const agent = supertest(server);

  return new Proxy(agent, {
    get(target, property) {
      const member = Reflect.get(target, property, target);

      if (protectedMethods.has(property)) {
        return (...args) => {
          if (!accessToken) {
            throw new Error(
              'Question integration test auth token is not initialized.',
            );
          }

          return member
            .apply(target, args)
            .set('Authorization', `Bearer ${accessToken}`);
        };
      }

      return typeof member === 'function'
        ? member.bind(target)
        : member;
    },
  });
}

async function setupQuestionTestAuth(app, prisma, suffix) {
  const jwtService = app.get(JwtService);

  const permissionKeys = [
    'questions.read',
    'content.manage',
  ];

  const permissions = await Promise.all(
    permissionKeys.map((key) =>
      prisma.permission.upsert({
        where: { key },
        update: {},
        create: {
          key,
          description: `Integration test permission: ${key}`,
        },
      }),
    ),
  );

  const role = await prisma.role.create({
    data: {
      name: `TEST_QUESTION_ACCESS_${suffix}`,
      description: 'Temporary question integration test role.',
    },
  });

  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({
      roleId: role.id,
      permissionId: permission.id,
    })),
  });

  const user = await prisma.user.create({
    data: {
      name: 'Question Integration Test User',
      email: `question-integration-${suffix}@example.test`,
      status: 'ACTIVE',
      userRoles: {
        create: {
          roleId: role.id,
        },
      },
    },
  });

  accessToken = jwtService.sign({
    sub: user.id,
    ver: user.tokenVersion,
  });

  return {
    roleId: role.id,
    userId: user.id,
  };
}

async function cleanupQuestionTestAuth(prisma, auth) {
  if (!auth) {
    accessToken = null;
    return;
  }

  try {
    await prisma.user.deleteMany({
      where: { id: auth.userId },
    });

    await prisma.rolePermission.deleteMany({
      where: { roleId: auth.roleId },
    });

    await prisma.role.deleteMany({
      where: { id: auth.roleId },
    });
  } finally {
    accessToken = null;
  }
}

module.exports = {
  request,
  setupQuestionTestAuth,
  cleanupQuestionTestAuth,
};
