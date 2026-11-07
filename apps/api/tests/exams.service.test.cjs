
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  BadRequestException,
  ConflictException,
  NotFoundException,
} = require('@nestjs/common');

const { ExamsService } = require('../dist/modules/exams/exams.service');

const INSTITUTION_ID = '11111111-1111-4111-8111-111111111111';
const POST_ID = '22222222-2222-4222-8222-222222222222';
const EXAM_ID = '33333333-3333-4333-8333-333333333333';

function createPrisma() {
  return {
    institution: {
      findUnique: async () => null,
    },
    post: {
      findUnique: async () => null,
    },
    exam: {
      findFirst: async () => null,
      findUnique: async () => null,
      create: async ({ data }) => ({ id: EXAM_ID, ...data }),
      findMany: async () => [],
      count: async () => 0,
      update: async ({ data }) => ({ id: EXAM_ID, ...data }),
      delete: async () => ({ id: EXAM_ID }),
    },
  };
}

function createService(prisma = createPrisma()) {
  return {
    prisma,
    service: new ExamsService(prisma),
  };
}

function sampleExam(overrides = {}) {
  return {
    id: EXAM_ID,
    name: '46th BCS Preliminary',
    slug: '46th-bcs-preliminary',
    examYear: 2023,
    examType: 'PRELIMINARY',
    description: null,
    institutionId: null,
    postId: null,
    _count: {
      occurrences: 0,
    },
    ...overrides,
  };
}

// 01. Reject empty exam name
test('create rejects an empty exam name', async () => {
  const { service } = createService();

  await assert.rejects(
    () => service.create({
      name: '   ',
      examYear: 2023,
    }),
    BadRequestException,
  );
});

// 02. Reject invalid slug
test('create rejects an invalid empty slug', async () => {
  const { service } = createService();

  await assert.rejects(
    () => service.create({
      name: '46th BCS',
      slug: '---',
      examYear: 2023,
    }),
    BadRequestException,
  );
});

// 03. Create exam successfully
test('create creates an exam with generated slug', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  let createData;

  prisma.exam.create = async ({ data }) => {
    createData = data;
    return sampleExam(data);
  };

  const result = await service.create({
    name: '  46th BCS Preliminary  ',
    examYear: 2023,
    examType: ' PRELIMINARY ',
    description: '  Preliminary exam  ',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.name, '46th BCS Preliminary');
  assert.equal(createData.slug, '46th-bcs-preliminary');
  assert.equal(createData.examType, 'PRELIMINARY');
  assert.equal(createData.description, 'Preliminary exam');
});

// 04. Missing institution
test('create rejects a missing institution', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.institution.findUnique = async () => null;

  await assert.rejects(
    () => service.create({
      name: '46th BCS',
      examYear: 2023,
      institutionId: INSTITUTION_ID,
    }),
    NotFoundException,
  );
});

// 05. Inactive institution
test('create rejects an inactive institution', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.institution.findUnique = async () => ({
    id: INSTITUTION_ID,
    isActive: false,
  });

  await assert.rejects(
    () => service.create({
      name: '46th BCS',
      examYear: 2023,
      institutionId: INSTITUTION_ID,
    }),
    BadRequestException,
  );
});

// 06. Missing post
test('create rejects a missing post', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.post.findUnique = async () => null;

  await assert.rejects(
    () => service.create({
      name: '46th BCS',
      examYear: 2023,
      postId: POST_ID,
    }),
    NotFoundException,
  );
});

// 07. Duplicate exam
test('create rejects a duplicate exam combination', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.exam.findFirst = async () => sampleExam();

  await assert.rejects(
    () => service.create({
      name: '46th BCS Preliminary',
      examYear: 2023,
      examType: 'PRELIMINARY',
    }),
    ConflictException,
  );
});

// 08. Duplicate slug
test('create rejects an already existing slug', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  let calls = 0;

  prisma.exam.findFirst = async () => {
    calls += 1;
    return calls === 1 ? null : sampleExam();
  };

  await assert.rejects(
    () => service.create({
      name: '46th BCS Preliminary',
      examYear: 2023,
    }),
    ConflictException,
  );

  assert.equal(calls, 2);
});

// 09. Find all with default pagination
test('findAll uses default pagination', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  let findManyArgs;

  prisma.exam.findMany = async (args) => {
    findManyArgs = args;
    return [];
  };

  const result = await service.findAll({});

  assert.equal(result.success, true);
  assert.equal(result.pagination.page, 1);
  assert.equal(result.pagination.limit, 20);
  assert.equal(findManyArgs.skip, 0);
  assert.equal(findManyArgs.take, 20);
});

// 10. Pagination limit maximum
test('findAll limits page size to 100', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  let findManyArgs;

  prisma.exam.findMany = async (args) => {
    findManyArgs = args;
    return [];
  };

  const result = await service.findAll({
    page: 2,
    limit: 500,
  });

  assert.equal(result.pagination.page, 2);
  assert.equal(result.pagination.limit, 100);
  assert.equal(findManyArgs.skip, 100);
  assert.equal(findManyArgs.take, 100);
});

// 11. Search and filters
test('findAll applies search and exam filters', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  let findManyArgs;

  prisma.exam.findMany = async (args) => {
    findManyArgs = args;
    return [];
  };

  await service.findAll({
    search: 'BCS',
    institutionId: INSTITUTION_ID,
    postId: POST_ID,
    examYear: 2023,
    examType: 'PRELIMINARY',
  });

  assert.equal(findManyArgs.where.institutionId, INSTITUTION_ID);
  assert.equal(findManyArgs.where.postId, POST_ID);
  assert.equal(findManyArgs.where.examYear, 2023);
  assert.equal(
    findManyArgs.where.examType.equals,
    'PRELIMINARY',
  );
  assert.equal(findManyArgs.where.OR.length, 4);
});

// 12. Invalid institution UUID
test('findAll rejects an invalid institutionId', async () => {
  const { service } = createService();

  await assert.rejects(
    () => service.findAll({
      institutionId: 'invalid-id',
    }),
    BadRequestException,
  );
});

// 13. Invalid post UUID
test('findAll rejects an invalid postId', async () => {
  const { service } = createService();

  await assert.rejects(
    () => service.findAll({
      postId: 'invalid-id',
    }),
    BadRequestException,
  );
});

// 14. Invalid exam year
test('findAll rejects an invalid examYear', async () => {
  const { service } = createService();

  await assert.rejects(
    () => service.findAll({
      examYear: 1800,
    }),
    BadRequestException,
  );
});

// 15. Find one successfully
test('findOne returns exam details', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.exam.findUnique = async () => sampleExam();

  const result = await service.findOne(EXAM_ID);

  assert.equal(result.success, true);
  assert.equal(result.data.id, EXAM_ID);
});

// 16. Find one missing exam
test('findOne throws when exam does not exist', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.exam.findUnique = async () => null;

  await assert.rejects(
    () => service.findOne(EXAM_ID),
    NotFoundException,
  );
});

// 17. Update without fields
test('update rejects an empty update request', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.exam.findUnique = async () => sampleExam();

  await assert.rejects(
    () => service.update(EXAM_ID, {}),
    BadRequestException,
  );
});

// 18. Update missing exam
test('update rejects a missing exam', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.exam.findUnique = async () => null;

  await assert.rejects(
    () => service.update(EXAM_ID, {
      description: 'Updated description',
    }),
    NotFoundException,
  );
});

// 19. Update with empty name
test('update rejects an empty exam name', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.exam.findUnique = async () => sampleExam();

  await assert.rejects(
    () => service.update(EXAM_ID, {
      name: '   ',
    }),
    BadRequestException,
  );
});

// 20. Prevent structural changes when occurrences exist
test('update prevents structural changes when questions are linked', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.exam.findUnique = async () => sampleExam({
    _count: {
      occurrences: 5,
    },
  });

  await assert.rejects(
    () => service.update(EXAM_ID, {
      examYear: 2024,
    }),
    BadRequestException,
  );
});

// 21. Update description successfully
test('update changes exam description', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.exam.findUnique = async () => sampleExam();

  let updateArgs;

  prisma.exam.update = async (args) => {
    updateArgs = args;
    return sampleExam({
      description: 'Updated description',
    });
  };

  const result = await service.update(EXAM_ID, {
    description: '  Updated description  ',
  });

  assert.equal(result.success, true);
  assert.equal(
    updateArgs.data.description,
    'Updated description',
  );
});

// 22. Update name and slug
test('update changes exam name and generates a new slug', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.exam.findUnique = async () => sampleExam();

  let updateArgs;

  prisma.exam.update = async (args) => {
    updateArgs = args;
    return sampleExam({
      name: '47th BCS Preliminary',
      slug: '47th-bcs-preliminary',
    });
  };

  const result = await service.update(EXAM_ID, {
    name: '47th BCS Preliminary',
  });

  assert.equal(result.success, true);
  assert.equal(updateArgs.data.name, '47th BCS Preliminary');
  assert.equal(updateArgs.data.slug, '47th-bcs-preliminary');
});

// 23. Prevent deletion with occurrences
test('remove rejects an exam with question occurrences', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.exam.findUnique = async () => sampleExam({
    _count: {
      occurrences: 3,
    },
  });

  await assert.rejects(
    () => service.remove(EXAM_ID),
    BadRequestException,
  );
});

// 24. Remove missing exam
test('remove rejects a missing exam', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.exam.findUnique = async () => null;

  await assert.rejects(
    () => service.remove(EXAM_ID),
    NotFoundException,
  );
});

// 25. Remove exam successfully
test('remove deletes an exam without occurrences', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  let deleted = false;

  prisma.exam.findUnique = async () => sampleExam();

  prisma.exam.delete = async () => {
    deleted = true;
    return { id: EXAM_ID };
  };

  const result = await service.remove(EXAM_ID);

  assert.equal(result.success, true);
  assert.equal(deleted, true);
});
