
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '../../../.env'),
});

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is missing from the project root .env file.',
  );
}

let databaseName;

try {
  databaseName = decodeURIComponent(
    new URL(testDatabaseUrl).pathname.replace(/^\/+/, ''),
  );
} catch {
  throw new Error('TEST_DATABASE_URL is not a valid PostgreSQL URL.');
}

if (databaseName !== 'shikhasetu_test') {
  throw new Error(
    `Unsafe integration test database: "${databaseName}". Expected "shikhasetu_test".`,
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
const helmetPackage = require('helmet');
const helmet = helmetPackage.default || helmetPackage;
const request = require('supertest');

const { AppModule } = require('../src/app.module');
const { HttpExceptionFilter } = require(
  '../src/common/filters/http-exception.filter',
);

let app;

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
    .filter((origin) => origin.length > 0);

  if (allowedOrigins.length === 0) {
    throw new Error(
      'CORS_ORIGINS is missing. Configure it in the root .env file.',
    );
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
});

after(async () => {
  try {
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

test('GET /api/health should return healthy API status', async () => {
  const response = await request(app.getHttpServer())
    .get('/api/health')
    .expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.application, 'Shikhasetu API');
  assert.equal(response.body.status, 'Healthy');
  assert.equal(
    response.body.message,
    'API server is running successfully.',
  );

  assert.ok(
    !Number.isNaN(Date.parse(response.body.timestamp)),
    'Health response should contain a valid timestamp.',
  );
});

test('GET /api/database/test should connect to the test database', async () => {
  const response = await request(app.getHttpServer())
    .get('/api/database/test')
    .expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.database, 'Connected');
  assert.equal(
    response.body.message,
    'PostgreSQL connection is working successfully.',
  );
});
