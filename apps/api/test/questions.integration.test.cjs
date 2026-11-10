
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
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
    `Unsafe database: ${databaseName}. Expected shikhasetu_test.`,
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
const {
  request,
  setupQuestionTestAuth,
  cleanupQuestionTestAuth,
} = require('./question-test-auth.cjs');

const { AppModule } = require('../src/app.module');
const { PrismaService } = require('../src/database/prisma.service');
const { HttpExceptionFilter } = require(
  '../src/common/filters/http-exception.filter',
);

const suffix = randomUUID().replace(/-/g, '');

const subjectName = `Integration Subject ${suffix}`;
const topicName = `Integration Topic ${suffix}`;

let app;
let prisma;
let auth;
let subject;
let topic;
let questionId;

const originalQuestionText = `Original integration question ${suffix}`;
const updatedQuestionText = `Updated integration question ${suffix}`;

const validQuestion = () => ({
  questionText: originalQuestionText,
  questionType: 'MCQ',
  subject: subjectName,
  topic: topicName,
  subjectId: subject.id,
  topicId: topic.id,
  correctAnswer: 'Option A',
  explanation: 'Integration test explanation.',
  difficulty: 'MEDIUM',
  status: 'DRAFT',
  options: [
    {
      label: 'A',
      optionText: 'Correct option',
      isCorrect: true,
      sortOrder: 1,
    },
    {
      label: 'B',
      optionText: 'Incorrect option',
      isCorrect: false,
      sortOrder: 2,
    },
  ],
  occurrences: [
    {
      institution: 'Integration Test Institution',
      examName: 'Integration Test Exam',
      examYear: 2025,
      postName: 'Test Officer',
      source: 'Integration Test',
      sourcePage: 1,
    },
  ],
});

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

  auth = await setupQuestionTestAuth(app, prisma, suffix);

  subject = await prisma.subject.create({
    data: {
      name: subjectName,
      slug: `integration-subject-${suffix}`,
      description: 'Question integration test fixture.',
      isActive: true,
    },
  });

  topic = await prisma.topic.create({
    data: {
      subjectId: subject.id,
      name: topicName,
      slug: `integration-topic-${suffix}`,
      description: 'Question integration test topic.',
      isActive: true,
    },
  });
});

after(async () => {
  try {
    if (prisma) {
      await cleanupQuestionTestAuth(prisma, auth);

      if (questionId) {
        await prisma.question.deleteMany({
          where: { id: questionId },
        });
      }

      if (topic) {
        await prisma.topic.deleteMany({
          where: { id: topic.id },
        });
      }

      if (subject) {
        await prisma.subject.deleteMany({
          where: { id: subject.id },
        });
      }
    }
  } finally {
    if (app) {
      await app.close();
    }

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  }
});

// ==========================================
// CREATE TESTS
// ==========================================

test('POST /api/questions should create a valid MCQ', async () => {
  const payload = validQuestion();

  const response = await request(app.getHttpServer())
    .post('/api/questions')
    .send(payload)
    .expect(201);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.questionText, payload.questionText);
  assert.equal(response.body.data.subjectId, subject.id);
  assert.equal(response.body.data.topicId, topic.id);

  assert.equal(response.body.data.options.length, 2);
  assert.equal(response.body.data.occurrences.length, 1);

  assert.equal(
    response.body.data.options.filter((option) => option.isCorrect).length,
    1,
  );

  questionId = response.body.data.id;

  const savedQuestion = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      options: true,
      occurrences: true,
    },
  });

  assert.ok(savedQuestion);
  assert.equal(savedQuestion.options.length, 2);
  assert.equal(savedQuestion.occurrences.length, 1);
});

test('POST /api/questions should reject MCQ without options', async () => {
  const payload = validQuestion();
  delete payload.options;

  const response = await request(app.getHttpServer())
    .post('/api/questions')
    .send(payload)
    .expect(400);

  assert.equal(response.body.statusCode, 400);
});

test('POST /api/questions should reject MCQ without a correct option', async () => {
  const payload = validQuestion();

  payload.options.forEach((option) => {
    option.isCorrect = false;
  });

  const response = await request(app.getHttpServer())
    .post('/api/questions')
    .send(payload)
    .expect(400);

  assert.equal(response.body.statusCode, 400);
});

test('POST /api/questions should reject MCQ with multiple correct options', async () => {
  const payload = validQuestion();

  payload.options[1].isCorrect = true;

  const response = await request(app.getHttpServer())
    .post('/api/questions')
    .send(payload)
    .expect(400);

  assert.equal(response.body.statusCode, 400);
});

test('POST /api/questions should reject an invalid Subject ID', async () => {
  const payload = validQuestion();
  payload.subjectId = randomUUID();

  const response = await request(app.getHttpServer())
    .post('/api/questions')
    .send(payload)
    .expect(400);

  assert.equal(response.body.statusCode, 400);
});

test('POST /api/questions should reject an invalid Topic ID', async () => {
  const payload = validQuestion();
  payload.topicId = randomUUID();

  const response = await request(app.getHttpServer())
    .post('/api/questions')
    .send(payload)
    .expect(400);

  assert.equal(response.body.statusCode, 400);
});

// ==========================================
// UPDATE TESTS
// ==========================================

test('PUT /api/questions/:id should update a question', async () => {
  const response = await request(app.getHttpServer())
    .put(`/api/questions/${questionId}`)
    .send({
      questionText: updatedQuestionText,
      changeNote: 'Integration test update.',
    })
    .expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.questionText, updatedQuestionText);
  assert.equal(response.body.version, 1);

  const savedQuestion = await prisma.question.findUnique({
    where: { id: questionId },
  });

  assert.equal(savedQuestion.questionText, updatedQuestionText);
});

test('PUT /api/questions/:id should reject an empty update', async () => {
  const response = await request(app.getHttpServer())
    .put(`/api/questions/${questionId}`)
    .send({})
    .expect(400);

  assert.equal(response.body.statusCode, 400);
});

// ==========================================
// HISTORY TESTS
// ==========================================

test('GET /api/questions/:id/history should return saved history', async () => {
  const response = await request(app.getHttpServer())
    .get(`/api/questions/${questionId}/history`)
    .expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.question.id, questionId);
  assert.equal(response.body.totalVersions, 1);
  assert.equal(response.body.data[0].version, 1);

  assert.equal(
    response.body.data[0].snapshot.questionText,
    originalQuestionText,
  );
});

test('GET /api/questions/:id/history/:version should return a specific version', async () => {
  const response = await request(app.getHttpServer())
    .get(`/api/questions/${questionId}/history/1`)
    .expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.version, 1);
  assert.equal(
    response.body.data.snapshot.questionText,
    originalQuestionText,
  );
});

test('GET /api/questions/:id/history/:version should reject a missing version', async () => {
  const response = await request(app.getHttpServer())
    .get(`/api/questions/${questionId}/history/999`)
    .expect(404);

  assert.equal(response.body.statusCode, 404);
});

// ==========================================
// RESTORE TESTS
// ==========================================

test('POST /api/questions/:id/restore/:version should restore an older version', async () => {
  const response = await request(app.getHttpServer())
    .post(`/api/questions/${questionId}/restore/1`)
    .expect(201);

  assert.equal(response.body.success, true);
  assert.equal(response.body.restoredFromVersion, 1);
  assert.equal(response.body.savedCurrentVersion, 2);

  assert.equal(
    response.body.data.questionText,
    originalQuestionText,
  );

  assert.equal(response.body.data.options.length, 2);
  assert.equal(response.body.data.occurrences.length, 1);

  const savedQuestion = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      options: true,
      occurrences: true,
    },
  });

  assert.equal(savedQuestion.questionText, originalQuestionText);
  assert.equal(savedQuestion.options.length, 2);
  assert.equal(savedQuestion.occurrences.length, 1);

  const histories = await prisma.questionHistory.findMany({
    where: { questionId },
    orderBy: { version: 'asc' },
  });

  assert.equal(histories.length, 2);
  assert.equal(histories[1].version, 2);
  assert.equal(
    histories[1].snapshot.questionText,
    updatedQuestionText,
  );
});

test('POST /api/questions/:id/restore/:version should reject a missing version', async () => {
  const response = await request(app.getHttpServer())
    .post(`/api/questions/${questionId}/restore/999`)
    .expect(404);

  assert.equal(response.body.statusCode, 404);
});

test('POST /api/questions/:id/restore/:version should reject a non-numeric version', async () => {
  const response = await request(app.getHttpServer())
    .post(`/api/questions/${questionId}/restore/invalid`)
    .expect(400);

  assert.equal(response.body.statusCode, 400);
});


