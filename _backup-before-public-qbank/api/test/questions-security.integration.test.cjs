
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '../../../.env'),
});

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is missing.');
}

let databaseName;

try {
  databaseName = decodeURIComponent(
    new URL(testDatabaseUrl).pathname.replace(/^\/+/, ''),
  );
} catch {
  throw new Error('TEST_DATABASE_URL is invalid.');
}

if (databaseName !== 'shikhasetu_test') {
  throw new Error(
    `Unsafe test database: ${databaseName}. Expected shikhasetu_test.`,
  );
}

const originalDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = testDatabaseUrl;

process.env.TS_NODE_PROJECT = path.resolve(
  __dirname,
  '../tsconfig.json',
);

require('reflect-metadata');
require('ts-node/register/transpile-only');

const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const helmetPackage = require('helmet');
const helmet = helmetPackage.default || helmetPackage;
const request = require('supertest');

const { AppModule } = require('../src/app.module');
const { PrismaService } = require('../src/database/prisma.service');
const { HttpExceptionFilter } = require(
  '../src/common/filters/http-exception.filter',
);

let app;
let prisma;
let jwtService;

let readerUser;
let noPermissionUser;
let readerRole;
let noPermissionRole;
let readerToken;
let noPermissionToken;

const createdPermissionKey = 'questions.read';
let permissionCreatedByTest = false;

before(async () => {
  const testingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = testingModule.createNestApplication();

  app.use(helmet());
  app.setGlobalPrefix('api');

  const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (allowedOrigins.length === 0) {
    throw new Error('CORS_ORIGINS is missing.');
  }

  app.enableCors({
    origin: allowedOrigins,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();

  prisma = app.get(PrismaService);
  jwtService = app.get(JwtService);

  const existingPermission = await prisma.permission.findUnique({
    where: { key: createdPermissionKey },
  });

  permissionCreatedByTest = !existingPermission;

  const permission = await prisma.permission.upsert({
    where: { key: createdPermissionKey },
    update: {},
    create: {
      key: createdPermissionKey,
      description: 'Question read permission for integration testing.',
    },
  });

  const suffix = crypto.randomUUID();

  readerRole = await prisma.role.create({
    data: {
      name: `TEST_QUESTION_READER_${suffix}`,
      description: 'Temporary integration test role.',
    },
  });

  noPermissionRole = await prisma.role.create({
    data: {
      name: `TEST_NO_PERMISSION_${suffix}`,
      description: 'Temporary integration test role.',
    },
  });

  await prisma.rolePermission.create({
    data: {
      roleId: readerRole.id,
      permissionId: permission.id,
    },
  });

  readerUser = await prisma.user.create({
    data: {
      name: 'Question Security Reader',
      email: `question-reader-${suffix}@example.test`,
      status: 'ACTIVE',
      userRoles: {
        create: {
          roleId: readerRole.id,
        },
      },
    },
  });

  noPermissionUser = await prisma.user.create({
    data: {
      name: 'Question Security Restricted User',
      email: `question-restricted-${suffix}@example.test`,
      status: 'ACTIVE',
      userRoles: {
        create: {
          roleId: noPermissionRole.id,
        },
      },
    },
  });

  readerToken = jwtService.sign({
    sub: readerUser.id,
    ver: readerUser.tokenVersion,
  });

  noPermissionToken = jwtService.sign({
    sub: noPermissionUser.id,
    ver: noPermissionUser.tokenVersion,
  });
});

after(async () => {
  try {
    if (prisma) {
      if (readerUser) {
        await prisma.user.deleteMany({
          where: { id: readerUser.id },
        });
      }

      if (noPermissionUser) {
        await prisma.user.deleteMany({
          where: { id: noPermissionUser.id },
        });
      }

      if (readerRole) {
        await prisma.role.deleteMany({
          where: { id: readerRole.id },
        });
      }

      if (noPermissionRole) {
        await prisma.role.deleteMany({
          where: { id: noPermissionRole.id },
        });
      }

      if (permissionCreatedByTest) {
        await prisma.permission.deleteMany({
          where: { key: createdPermissionKey },
        });
      }
    }

    if (app) {
      await app.close();
    }
  } finally {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  }
});

test('Questions API should reject requests without authentication', async () => {
  await request(app.getHttpServer())
    .get('/api/questions')
    .expect(401);
});

test('Questions API should reject authenticated users without questions.read permission', async () => {
  await request(app.getHttpServer())
    .get('/api/questions')
    .set('Authorization', `Bearer ${noPermissionToken}`)
    .expect(403);
});

test('Questions API should allow users with questions.read permission', async () => {
  const response = await request(app.getHttpServer())
    .get('/api/questions')
    .set('Authorization', `Bearer ${readerToken}`)
    .expect(200);

  assert.equal(typeof response.body, 'object');
});

test('Question creation should reject users without content.manage permission', async () => {
  await request(app.getHttpServer())
    .post('/api/questions')
    .set('Authorization', `Bearer ${readerToken}`)
    .send({})
    .expect(403);
});

test('Question trash should reject users without content.manage permission', async () => {
  await request(app.getHttpServer())
    .get('/api/questions/trash')
    .set('Authorization', `Bearer ${readerToken}`)
    .expect(403);
});
