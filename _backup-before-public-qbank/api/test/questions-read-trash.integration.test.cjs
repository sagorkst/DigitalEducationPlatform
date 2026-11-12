
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

const subjectName = `Read Trash Subject ${suffix}`;
const topicName = `Read Trash Topic ${suffix}`;

let app;
let prisma;
let auth;
let subject;
let topic;

let questionId;
let questionCode;

const questionText = `Read Trash integration question ${suffix}`;

const validQuestion = () => ({
  questionText,
  questionType: 'MCQ',
  subject: subjectName,
  topic: topicName,
  subjectId: subject.id,
  topicId: topic.id,
  correctAnswer: 'Option A',
  explanation: 'Read and trash integration explanation.',
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
      institution: 'Read Trash Test Institution',
      examName: 'Read Trash Test Exam',
      examYear: 2025,
      postName: 'Test Officer',
      source: 'Read Trash Integration',
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
      slug: `read-trash-subject-${suffix}`,
      description: 'Read and trash integration fixture.',
      isActive: true,
    },
  });

  topic = await prisma.topic.create({
    data: {
      subjectId: subject.id,
      name: topicName,
      slug: `read-trash-topic-${suffix}`,
      description: 'Read and trash integration topic.',
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
// CREATE FIXTURE
// ==========================================

test('POST /api/questions should create a fixture for read and trash tests', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/questions')
    .send(validQuestion())
    .expect(201);

  assert.equal(response.body.success, true);

  questionId = response.body.data.id;
  questionCode = response.body.data.questionCode;

  assert.ok(questionId);
  assert.ok(questionCode);
});

// ==========================================
// READ TESTS
// ==========================================

test('GET /api/questions/:id should return a question with relations', async () => {
  const response = await request(app.getHttpServer())
    .get(`/api/questions/${questionId}`)
    .expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.id, questionId);
  assert.equal(response.body.data.questionText, questionText);
  assert.equal(response.body.data.options.length, 2);
  assert.equal(response.body.data.occurrences.length, 1);
});

test('GET /api/questions should return paginated questions', async () => {
  const response = await request(app.getHttpServer())
    .get('/api/questions')
    .query({
      page: 1,
      limit: 10,
      search: questionCode,
    })
    .expect(200);

  assert.equal(response.body.success, true);
  assert.ok(Array.isArray(response.body.data));
  assert.ok(response.body.pagination);
  assert.equal(response.body.pagination.page, 1);
  assert.equal(response.body.pagination.limit, 10);

  assert.ok(
    response.body.data.some((question) => question.id === questionId),
  );
});

test('GET /api/questions should filter by subject', async () => {
  const response = await request(app.getHttpServer())
    .get('/api/questions')
    .query({
      subject: subjectName,
    })
    .expect(200);

  assert.equal(response.body.success, true);

  assert.ok(
    response.body.data.some((question) => question.id === questionId),
  );
});

test('GET /api/questions should filter by topic', async () => {
  const response = await request(app.getHttpServer())
    .get('/api/questions')
    .query({
      topic: topicName,
    })
    .expect(200);

  assert.equal(response.body.success, true);

  assert.ok(
    response.body.data.some((question) => question.id === questionId),
  );
});

test('GET /api/questions should reject an invalid year range', async () => {
  const response = await request(app.getHttpServer())
    .get('/api/questions')
    .query({
      yearFrom: 2025,
      yearTo: 2020,
    })
    .expect(400);

  assert.equal(response.body.statusCode, 400);
});

test('GET /api/questions should reject an invalid question type filter', async () => {
  const response = await request(app.getHttpServer())
    .get('/api/questions')
    .query({
      questionType: 'INVALID_TYPE',
    })
    .expect(400);

  assert.equal(response.body.statusCode, 400);
});

test('GET /api/questions/:id should return 404 for an unknown question', async () => {
  const response = await request(app.getHttpServer())
    .get(`/api/questions/${randomUUID()}`)
    .expect(404);

  assert.equal(response.body.statusCode, 404);
});

// ==========================================
// SOFT DELETE TESTS
// ==========================================

test('DELETE /api/questions/:id should move a question to trash', async () => {
  const response = await request(app.getHttpServer())
    .delete(`/api/questions/${questionId}`)
    .expect(200);

  assert.equal(response.body.success, true);
  assert.ok(response.body.data.deletedAt);

  const savedQuestion = await prisma.question.findUnique({
    where: { id: questionId },
  });

  assert.ok(savedQuestion.deletedAt);
});

test('GET /api/questions/:id should hide a trashed question', async () => {
  const response = await request(app.getHttpServer())
    .get(`/api/questions/${questionId}`)
    .expect(404);

  assert.equal(response.body.statusCode, 404);
});

test('GET /api/questions should exclude trashed questions', async () => {
  const response = await request(app.getHttpServer())
    .get('/api/questions')
    .query({
      search: questionCode,
    })
    .expect(200);

  assert.equal(response.body.success, true);

  assert.equal(
    response.body.data.some((question) => question.id === questionId),
    false,
  );
});

// ==========================================
// TRASH LIST TESTS
// ==========================================

test('GET /api/questions/trash should return deleted questions', async () => {
  const response = await request(app.getHttpServer())
    .get('/api/questions/trash')
    .query({
      search: questionCode,
    })
    .expect(200);

  assert.equal(response.body.success, true);
  assert.ok(Array.isArray(response.body.data));

  assert.ok(
    response.body.data.some((question) => question.id === questionId),
  );

  const trashedQuestion = response.body.data.find(
    (question) => question.id === questionId,
  );

  assert.ok(trashedQuestion.deletedAt);
  assert.equal(trashedQuestion.options.length, 2);
  assert.equal(trashedQuestion.occurrences.length, 1);
});

// ==========================================
// RECOVERY TESTS
// ==========================================

test('POST /api/questions/:id/recover should restore a trashed question', async () => {
  const response = await request(app.getHttpServer())
    .post(`/api/questions/${questionId}/recover`)
    .expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.deletedAt, null);

  const savedQuestion = await prisma.question.findUnique({
    where: { id: questionId },
  });

  assert.equal(savedQuestion.deletedAt, null);
});

test('GET /api/questions/:id should return a recovered question', async () => {
  const response = await request(app.getHttpServer())
    .get(`/api/questions/${questionId}`)
    .expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.id, questionId);
  assert.equal(response.body.data.questionText, questionText);
});

test('POST /api/questions/:id/recover should reject an active question', async () => {
  const response = await request(app.getHttpServer())
    .post(`/api/questions/${questionId}/recover`)
    .expect(200);

  assert.equal(response.body.success, false);
});

// ==========================================
// PERMANENT DELETE TESTS
// ==========================================

test('DELETE /api/questions/:id/permanent should reject an active question', async () => {
  const response = await request(app.getHttpServer())
    .delete(`/api/questions/${questionId}/permanent`)
    .expect(400);

  assert.equal(response.body.statusCode, 400);

  const savedQuestion = await prisma.question.findUnique({
    where: { id: questionId },
  });

  assert.ok(savedQuestion);
  assert.equal(savedQuestion.deletedAt, null);
});

test('DELETE /api/questions/:id should move question to trash before permanent deletion', async () => {
  const response = await request(app.getHttpServer())
    .delete(`/api/questions/${questionId}`)
    .expect(200);

  assert.equal(response.body.success, true);
  assert.ok(response.body.data.deletedAt);
});

test('DELETE /api/questions/:id/permanent should permanently delete a trashed question', async () => {
  const response = await request(app.getHttpServer())
    .delete(`/api/questions/${questionId}/permanent`)
    .expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.id, questionId);
  assert.equal(response.body.data.permanentlyDeleted, true);

  const savedQuestion = await prisma.question.findUnique({
    where: { id: questionId },
  });

  assert.equal(savedQuestion, null);

  questionId = null;
});

test('DELETE /api/questions/:id/permanent should return 404 for an unknown question', async () => {
  const response = await request(app.getHttpServer())
    .delete(`/api/questions/${randomUUID()}/permanent`)
    .expect(404);

  assert.equal(response.body.statusCode, 404);
});


