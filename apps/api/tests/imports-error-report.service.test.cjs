
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BadRequestException,
  NotFoundException,
} = require('@nestjs/common');

const {
  ImportsErrorReportService,
} = require('../dist/modules/imports/imports-error-report.service');

function createBatch(overrides = {}) {
  return {
    id: 'batch-001',
    fileName: 'questions.json',
    fileType: 'json',
    status: 'REVIEW',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    completedAt: null,
    totalRows: 4,
    validRows: 1,
    invalidRows: 1,
    duplicateRows: 1,
    importedRows: 0,
    skippedRows: 1,
    rows: [
      {
        rowNumber: 1,
        status: 'VALID',
        errorMessages: null,
        rawData: { questionText: 'Valid question' },
        questionId: null,
      },
      {
        rowNumber: 2,
        status: 'INVALID',
        errorMessages: ['Missing question text', 'Invalid subject'],
        rawData: { questionText: '' },
        questionId: null,
      },
      {
        rowNumber: 3,
        status: 'DUPLICATE',
        errorMessages: 'Duplicate question detected',
        rawData: { questionText: 'Duplicate question' },
        questionId: 'question-001',
      },
      {
        rowNumber: 4,
        status: 'SKIPPED',
        errorMessages: null,
        rawData: { questionText: 'Skipped question' },
        questionId: null,
      },
    ],
    ...overrides,
  };
}

function createService(batch = createBatch()) {
  const prisma = {
    importBatch: {
      findUnique: async () => batch,
    },
  };

  return {
    service: new ImportsErrorReportService(prisma),
    prisma,
  };
}

test('generateReport uses JSON as the default format', async () => {
  const { service } = createService();

  const result = await service.generateReport('batch-001');

  assert.equal(
    result.fileName,
    'import-error-report-batch-001.json',
  );
});

test('generateReport rejects unsupported format', async () => {
  const { service } = createService();

  await assert.rejects(
    service.generateReport('batch-001', 'xlsx'),
    BadRequestException,
  );
});

test('generateReport rejects empty format', async () => {
  const { service } = createService();

  await assert.rejects(
    service.generateReport('batch-001', ''),
    BadRequestException,
  );
});

test('generateReport accepts uppercase JSON format', async () => {
  const { service } = createService();

  const result = await service.generateReport('batch-001', 'JSON');

  assert.equal(
    result.fileName,
    'import-error-report-batch-001.json',
  );
});

test('generateReport accepts uppercase CSV format', async () => {
  const { service } = createService();

  const result = await service.generateReport('batch-001', 'CSV');

  assert.equal(
    result.fileName,
    'import-error-report-batch-001.csv',
  );
});

test('generateReport returns NotFoundException for missing batch', async () => {
  const { service } = createService(null);

  await assert.rejects(
    service.generateReport('missing-batch'),
    NotFoundException,
  );
});

test('generateReport queries batch by ID', async () => {
  const { service, prisma } = createService();

  let query;

  prisma.importBatch.findUnique = async (args) => {
    query = args;
    return createBatch();
  };

  await service.generateReport('batch-001');

  assert.deepEqual(query.where, {
    id: 'batch-001',
  });
});

test('generateReport includes rows ordered by rowNumber ascending', async () => {
  const { service, prisma } = createService();

  let query;

  prisma.importBatch.findUnique = async (args) => {
    query = args;
    return createBatch();
  };

  await service.generateReport('batch-001');

  assert.deepEqual(query.include.rows, {
    orderBy: {
      rowNumber: 'asc',
    },
  });
});

test('JSON report returns correct filename and content type', async () => {
  const { service } = createService();

  const result = await service.generateReport('batch-001', 'json');

  assert.equal(
    result.fileName,
    'import-error-report-batch-001.json',
  );

  assert.equal(
    result.contentType,
    'application/json; charset=utf-8',
  );

  assert.ok(Buffer.isBuffer(result.buffer));
});

test('JSON report includes reportGeneratedAt', async () => {
  const { service } = createService();

  const result = await service.generateReport('batch-001');
  const report = JSON.parse(result.buffer.toString('utf8'));

  assert.ok(report.reportGeneratedAt);
  assert.ok(Number.isFinite(Date.parse(report.reportGeneratedAt)));
});

test('JSON report includes batch metadata', async () => {
  const { service } = createService();

  const result = await service.generateReport('batch-001');
  const report = JSON.parse(result.buffer.toString('utf8'));

  assert.deepEqual(report.batch, {
    id: 'batch-001',
    fileName: 'questions.json',
    fileType: 'json',
    status: 'REVIEW',
    createdAt: '2026-01-01T10:00:00.000Z',
    completedAt: null,
  });
});

test('JSON report includes batch summary counts', async () => {
  const { service } = createService();

  const result = await service.generateReport('batch-001');
  const report = JSON.parse(result.buffer.toString('utf8'));

  assert.deepEqual(report.summary, {
    totalRows: 4,
    validRows: 1,
    invalidRows: 1,
    duplicateRows: 1,
    importedRows: 0,
    skippedRows: 1,
    errorRows: 2,
  });
});

test('JSON report includes INVALID and DUPLICATE rows only', async () => {
  const { service } = createService();

  const result = await service.generateReport('batch-001');
  const report = JSON.parse(result.buffer.toString('utf8'));

  assert.equal(report.errorRows.length, 2);

  assert.deepEqual(
    report.errorRows.map((row) => row.status),
    ['INVALID', 'DUPLICATE'],
  );
});

test('JSON report converts error message arrays correctly', async () => {
  const { service } = createService();

  const result = await service.generateReport('batch-001');
  const report = JSON.parse(result.buffer.toString('utf8'));

  assert.deepEqual(
    report.errorRows[0].errors,
    ['Missing question text', 'Invalid subject'],
  );
});

test('JSON report converts a single error message into an array', async () => {
  const { service } = createService();

  const result = await service.generateReport('batch-001');
  const report = JSON.parse(result.buffer.toString('utf8'));

  assert.deepEqual(
    report.errorRows[1].errors,
    ['Duplicate question detected'],
  );
});

test('JSON report converts null error messages into an empty array', async () => {
  const batch = createBatch({
    rows: [
      {
        rowNumber: 1,
        status: 'INVALID',
        errorMessages: null,
        rawData: {},
        questionId: null,
      },
    ],
  });

  const { service } = createService(batch);

  const result = await service.generateReport('batch-001');
  const report = JSON.parse(result.buffer.toString('utf8'));

  assert.deepEqual(report.errorRows[0].errors, []);
});

test('JSON report preserves rawData and questionId', async () => {
  const { service } = createService();

  const result = await service.generateReport('batch-001');
  const report = JSON.parse(result.buffer.toString('utf8'));

  assert.deepEqual(
    report.errorRows[0].rawData,
    { questionText: '' },
  );

  assert.equal(
    report.errorRows[1].questionId,
    'question-001',
  );
});

test('JSON report handles empty rows', async () => {
  const batch = createBatch({
    rows: [],
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    duplicateRows: 0,
    importedRows: 0,
    skippedRows: 0,
  });

  const { service } = createService(batch);

  const result = await service.generateReport('batch-001');
  const report = JSON.parse(result.buffer.toString('utf8'));

  assert.deepEqual(report.errorRows, []);
  assert.equal(report.summary.errorRows, 0);
});

test('JSON report handles non-array truthy errorMessages', async () => {
  const batch = createBatch({
    rows: [
      {
        rowNumber: 1,
        status: 'INVALID',
        errorMessages: 'Single error',
        rawData: {},
        questionId: null,
      },
    ],
  });

  const { service } = createService(batch);

  const result = await service.generateReport('batch-001');
  const report = JSON.parse(result.buffer.toString('utf8'));

  assert.deepEqual(
    report.errorRows[0].errors,
    ['Single error'],
  );
});

test('CSV report returns correct filename and content type', async () => {
  const { service } = createService();

  const result = await service.generateReport('batch-001', 'csv');

  assert.equal(
    result.fileName,
    'import-error-report-batch-001.csv',
  );

  assert.equal(
    result.contentType,
    'text/csv; charset=utf-8',
  );

  assert.ok(Buffer.isBuffer(result.buffer));
});

test('CSV report includes UTF-8 BOM', async () => {
  const { service } = createService();

  const result = await service.generateReport('batch-001', 'csv');

  assert.equal(
    result.buffer.subarray(0, 3).toString('hex'),
    'efbbbf',
  );
});

test('CSV report includes expected headers', async () => {
  const { service } = createService();

  const result = await service.generateReport('batch-001', 'csv');
  const csv = result.buffer.toString('utf8');

  const header = csv.replace(/^\uFEFF/, '').split('\n')[0];

  assert.deepEqual(
    header.split(','),
    ['rowNumber', 'status', 'errors', 'rawData', 'questionId'],
  );
});


test('CSV report exports INVALID and DUPLICATE rows only', async () => {
  const { service } = createService();

  const result = await service.generateReport('batch-001', 'csv');
  const csv = result.buffer.toString('utf8');

  assert.ok(csv.includes('INVALID'));
  assert.ok(csv.includes('DUPLICATE'));

  const dataLines = csv
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/)
    .slice(1);

  const statuses = dataLines.map((line) => {
    return line.split(',')[1];
  });

  assert.deepEqual(statuses, ['INVALID', 'DUPLICATE']);
});


test('CSV report serializes errors and rawData as JSON strings', async () => {
  const { service } = createService();

  const result = await service.generateReport('batch-001', 'csv');
  const csv = result.buffer.toString('utf8');

  assert.ok(csv.includes('Missing question text'));
  assert.ok(csv.includes('Duplicate question detected'));
  assert.ok(csv.includes('questionText'));
});

test('CSV report exports null questionId as an empty string', async () => {
  const { service } = createService(
    createBatch({
      rows: [
        {
          rowNumber: 1,
          status: 'INVALID',
          errorMessages: ['Invalid row'],
          rawData: {},
          questionId: null,
        },
      ],
    }),
  );

  const result = await service.generateReport('batch-001', 'csv');
  const csv = result.buffer.toString('utf8');

  assert.ok(csv.includes('Invalid row'));
});

test('CSV report handles no error rows', async () => {
  const batch = createBatch({
    rows: [
      {
        rowNumber: 1,
        status: 'VALID',
        errorMessages: null,
        rawData: {},
        questionId: null,
      },
    ],
  });

  const { service } = createService(batch);

  const result = await service.generateReport('batch-001', 'csv');

  assert.ok(Buffer.isBuffer(result.buffer));
  assert.ok(result.buffer.length > 0);
});

test('generateReport propagates Prisma database errors', async () => {
  const { service, prisma } = createService();

  prisma.importBatch.findUnique = async () => {
    throw new Error('Database connection failed');
  };

  await assert.rejects(
    service.generateReport('batch-001'),
    /Database connection failed/,
  );
});
