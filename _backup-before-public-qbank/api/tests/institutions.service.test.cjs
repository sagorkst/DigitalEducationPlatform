const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BadRequestException,
  ConflictException,
  NotFoundException,
} = require('@nestjs/common');

const { Prisma } = require('../dist/generated/prisma/client');
const {
  InstitutionsService,
} = require('../dist/modules/institutions/institutions.service');

const INSTITUTION_ID = 'institution-001';

function createInstitution(overrides = {}) {
  return {
    id: INSTITUTION_ID,
    name: 'Bangladesh Public Service Commission',
    slug: 'bangladesh-public-service-commission',
    type: 'Government',
    description: 'Government institution',
    website: 'https://example.gov.bd',
    isActive: true,
    _count: {
      exams: 0,
      occurrences: 0,
    },
    ...overrides,
  };
}

function createPrisma(overrides = {}) {
  return {
    institution: {
      findFirst: async () => null,
      findUnique: async () => createInstitution(),
      findMany: async () => [],
      count: async () => 0,
      create: async ({ data }) => createInstitution(data),
      update: async ({ data }) => createInstitution(data),
      delete: async () => createInstitution(),
      ...overrides.institution,
    },
  };
}

function createService(prismaOverrides = {}) {
  const prisma = createPrisma(prismaOverrides);
  const service = new InstitutionsService(prisma);

  return { service, prisma };
}

function prismaError(code) {
  return new Prisma.PrismaClientKnownRequestError(
    'Prisma test error',
    {
      code,
      clientVersion: 'test',
    },
  );
}

// =====================================================
// CREATE
// =====================================================

test('01 - creates institution successfully', async () => {
  const { service, prisma } = createService();

  let createArgs;

  prisma.institution.create = async (args) => {
    createArgs = args;
    return createInstitution(args.data);
  };

  const result = await service.create({
    name: '  Bangladesh Public Service Commission  ',
  });

  assert.equal(result.success, true);
  assert.equal(result.message, 'Institution created successfully.');
  assert.equal(createArgs.data.name, 'Bangladesh Public Service Commission');
  assert.equal(
    createArgs.data.slug,
    'bangladesh-public-service-commission',
  );
  assert.equal(createArgs.data.isActive, true);
  assert.equal(createArgs.data.type, null);
  assert.equal(createArgs.data.description, null);
  assert.equal(createArgs.data.website, null);
});

test('02 - trims optional institution fields', async () => {
  const { service, prisma } = createService();

  let createArgs;

  prisma.institution.create = async (args) => {
    createArgs = args;
    return createInstitution(args.data);
  };

  await service.create({
    name: 'Test Institution',
    type: '  Government  ',
    description: '  Test description  ',
    website: '  https://example.com  ',
  });

  assert.equal(createArgs.data.type, 'Government');
  assert.equal(createArgs.data.description, 'Test description');
  assert.equal(createArgs.data.website, 'https://example.com');
});

test('03 - respects custom isActive value', async () => {
  const { service, prisma } = createService();

  let createArgs;

  prisma.institution.create = async (args) => {
    createArgs = args;
    return createInstitution(args.data);
  };

  await service.create({
    name: 'Inactive Institution',
    isActive: false,
  });

  assert.equal(createArgs.data.isActive, false);
});

test('04 - rejects duplicate institution name', async () => {
  const { service, prisma } = createService();

  prisma.institution.findFirst = async () => createInstitution();

  await assert.rejects(
    service.create({ name: 'Bangladesh Public Service Commission' }),
    ConflictException,
  );
});

test('05 - rejects invalid institution name', async () => {
  const { service } = createService();

  await assert.rejects(
    service.create({ name: '   ' }),
    BadRequestException,
  );
});

test('06 - converts create P2002 error to ConflictException', async () => {
  const { service, prisma } = createService();

  prisma.institution.create = async () => {
    throw prismaError('P2002');
  };

  await assert.rejects(
    service.create({ name: 'New Institution' }),
    ConflictException,
  );
});

test('07 - propagates unrelated create errors', async () => {
  const { service, prisma } = createService();
  const error = new Error('Database unavailable');

  prisma.institution.create = async () => {
    throw error;
  };

  await assert.rejects(
    service.create({ name: 'New Institution' }),
    (received) => received === error,
  );
});

// =====================================================
// FIND ALL
// =====================================================

test('08 - returns institutions with default pagination', async () => {
  const { service, prisma } = createService();

  const institutions = [createInstitution()];

  prisma.institution.findMany = async () => institutions;
  prisma.institution.count = async () => 1;

  const result = await service.findAll({});

  assert.equal(result.success, true);
  assert.deepEqual(result.data, institutions);
  assert.deepEqual(result.pagination, {
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  });
});

test('09 - applies search filter to name, slug and description', async () => {
  const { service, prisma } = createService();

  let findManyArgs;

  prisma.institution.findMany = async (args) => {
    findManyArgs = args;
    return [];
  };

  await service.findAll({ search: '  commission  ' });

  assert.deepEqual(findManyArgs.where.OR, [
    {
      name: {
        contains: 'commission',
        mode: 'insensitive',
      },
    },
    {
      slug: {
        contains: 'commission',
        mode: 'insensitive',
      },
    },
    {
      description: {
        contains: 'commission',
        mode: 'insensitive',
      },
    },
  ]);
});

test('10 - applies institution type filter', async () => {
  const { service, prisma } = createService();

  let findManyArgs;

  prisma.institution.findMany = async (args) => {
    findManyArgs = args;
    return [];
  };

  await service.findAll({ type: '  Government  ' });

  assert.deepEqual(findManyArgs.where.type, {
    equals: 'Government',
    mode: 'insensitive',
  });
});

test('11 - filters active institutions', async () => {
  const { service, prisma } = createService();

  let findManyArgs;

  prisma.institution.findMany = async (args) => {
    findManyArgs = args;
    return [];
  };

  await service.findAll({ isActive: 'true' });

  assert.equal(findManyArgs.where.isActive, true);
});

test('12 - filters inactive institutions', async () => {
  const { service, prisma } = createService();

  let findManyArgs;

  prisma.institution.findMany = async (args) => {
    findManyArgs = args;
    return [];
  };

  await service.findAll({ isActive: 'false' });

  assert.equal(findManyArgs.where.isActive, false);
});

test('13 - rejects invalid isActive filter', async () => {
  const { service } = createService();

  await assert.rejects(
    service.findAll({ isActive: 'yes' }),
    BadRequestException,
  );
});

test('14 - applies pagination and calculates total pages', async () => {
  const { service, prisma } = createService();

  let findManyArgs;

  prisma.institution.findMany = async (args) => {
    findManyArgs = args;
    return [];
  };

  prisma.institution.count = async () => 45;

  const result = await service.findAll({
    page: 3,
    limit: 10,
  });

  assert.equal(findManyArgs.skip, 20);
  assert.equal(findManyArgs.take, 10);
  assert.equal(result.pagination.page, 3);
  assert.equal(result.pagination.limit, 10);
  assert.equal(result.pagination.totalPages, 5);
});

test('15 - limits maximum page size to 100', async () => {
  const { service, prisma } = createService();

  let findManyArgs;

  prisma.institution.findMany = async (args) => {
    findManyArgs = args;
    return [];
  };

  await service.findAll({ limit: 500 });

  assert.equal(findManyArgs.take, 100);
});

test('16 - enforces minimum page and limit values', async () => {
  const { service, prisma } = createService();

  let findManyArgs;

  prisma.institution.findMany = async (args) => {
    findManyArgs = args;
    return [];
  };

  const result = await service.findAll({
    page: 0,
    limit: 0,
  });

  assert.equal(findManyArgs.skip, 0);
  assert.equal(findManyArgs.take, 1);
  assert.equal(result.pagination.page, 1);
  assert.equal(result.pagination.limit, 1);
});

// =====================================================
// FIND ONE
// =====================================================

test('17 - returns institution details successfully', async () => {
  const { service, prisma } = createService();

  const institution = createInstitution();

  prisma.institution.findUnique = async () => institution;

  const result = await service.findOne(INSTITUTION_ID);

  assert.equal(result.success, true);
  assert.equal(result.data, institution);
});

test('18 - throws NotFoundException for missing institution', async () => {
  const { service, prisma } = createService();

  prisma.institution.findUnique = async () => null;

  await assert.rejects(
    service.findOne(INSTITUTION_ID),
    NotFoundException,
  );
});

// =====================================================
// UPDATE
// =====================================================

test('19 - throws NotFoundException when updating missing institution', async () => {
  const { service, prisma } = createService();

  prisma.institution.findUnique = async () => null;

  await assert.rejects(
    service.update(INSTITUTION_ID, { name: 'Updated Name' }),
    NotFoundException,
  );
});

test('20 - rejects empty update DTO', async () => {
  const { service } = createService();

  await assert.rejects(
    service.update(INSTITUTION_ID, {}),
    BadRequestException,
  );
});

test('21 - rejects empty institution name during update', async () => {
  const { service } = createService();

  await assert.rejects(
    service.update(INSTITUTION_ID, { name: '   ' }),
    BadRequestException,
  );
});

test('22 - rejects duplicate institution name during update', async () => {
  const { service, prisma } = createService();

  prisma.institution.findFirst = async () => createInstitution({
    id: 'another-institution',
  });

  await assert.rejects(
    service.update(INSTITUTION_ID, {
      name: 'Another Institution',
    }),
    ConflictException,
  );
});

test('23 - updates institution name and generates new slug', async () => {
  const { service, prisma } = createService();

  let updateArgs;

  prisma.institution.update = async (args) => {
    updateArgs = args;
    return createInstitution(args.data);
  };

  const result = await service.update(INSTITUTION_ID, {
    name: '  New Institution Name  ',
  });

  assert.equal(updateArgs.where.id, INSTITUTION_ID);
  assert.equal(updateArgs.data.name, 'New Institution Name');
  assert.equal(updateArgs.data.slug, 'new-institution-name');
  assert.equal(result.success, true);
  assert.equal(result.message, 'Institution updated successfully.');
});

test('24 - updates optional fields and active status', async () => {
  const { service, prisma } = createService();

  let updateArgs;

  prisma.institution.update = async (args) => {
    updateArgs = args;
    return createInstitution(args.data);
  };

  await service.update(INSTITUTION_ID, {
    type: '  Public  ',
    description: '  Updated description  ',
    website: '  ',
    isActive: false,
  });

  assert.equal(updateArgs.data.type, 'Public');
  assert.equal(updateArgs.data.description, 'Updated description');
  assert.equal(updateArgs.data.website, null);
  assert.equal(updateArgs.data.isActive, false);
});

test('25 - converts update P2002 error to ConflictException', async () => {
  const { service, prisma } = createService();

  prisma.institution.update = async () => {
    throw prismaError('P2002');
  };

  await assert.rejects(
    service.update(INSTITUTION_ID, {
      name: 'Updated Institution',
    }),
    ConflictException,
  );
});

// =====================================================
// REMOVE
// =====================================================

test('26 - throws NotFoundException when deleting missing institution', async () => {
  const { service, prisma } = createService();

  prisma.institution.findUnique = async () => null;

  await assert.rejects(
    service.remove(INSTITUTION_ID),
    NotFoundException,
  );
});

test('27 - prevents deletion when institution has exams', async () => {
  const { service, prisma } = createService();

  prisma.institution.findUnique = async () =>
    createInstitution({
      _count: {
        exams: 2,
        occurrences: 0,
      },
    });

  await assert.rejects(
    service.remove(INSTITUTION_ID),
    BadRequestException,
  );
});

test('28 - prevents deletion when institution has occurrences', async () => {
  const { service, prisma } = createService();

  prisma.institution.findUnique = async () =>
    createInstitution({
      _count: {
        exams: 0,
        occurrences: 3,
      },
    });

  await assert.rejects(
    service.remove(INSTITUTION_ID),
    BadRequestException,
  );
});

test('29 - deletes institution without associated records', async () => {
  const { service, prisma } = createService();

  let deleteArgs;

  prisma.institution.findUnique = async () =>
    createInstitution({
      _count: {
        exams: 0,
        occurrences: 0,
      },
    });

  prisma.institution.delete = async (args) => {
    deleteArgs = args;
    return createInstitution();
  };

  const result = await service.remove(INSTITUTION_ID);

  assert.deepEqual(deleteArgs, {
    where: { id: INSTITUTION_ID },
  });

  assert.equal(result.success, true);
  assert.equal(result.message, 'Institution deleted successfully.');
});