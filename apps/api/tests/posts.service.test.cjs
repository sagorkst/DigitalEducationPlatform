
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  BadRequestException,
  ConflictException,
  NotFoundException,
} = require('@nestjs/common');

const { PostsService } = require('../dist/modules/posts/posts.service');

const POST_ID = '22222222-2222-4222-8222-222222222222';

function createPrisma() {
  return {
    post: {
      findFirst: async () => null,
      findMany: async () => [],
      findUnique: async () => null,
      count: async () => 0,
      create: async ({ data }) => ({ id: POST_ID, ...data }),
      update: async ({ data }) => ({ id: POST_ID, ...data }),
      delete: async () => ({ id: POST_ID }),
    },
  };
}

function createService(prisma = createPrisma()) {
  return {
    prisma,
    service: new PostsService(prisma),
  };
}

function samplePost(overrides = {}) {
  return {
    id: POST_ID,
    name: 'Assistant Teacher',
    slug: 'assistant-teacher',
    description: null,
    _count: {
      occurrences: 0,
    },
    ...overrides,
  };
}

// 01. Reject empty name
test('create rejects an empty post name', async () => {
  const { service } = createService();

  await assert.rejects(
    () => service.create({ name: '   ' }),
    BadRequestException,
  );
});

// 02. Create successfully
test('create creates a post with generated slug', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  let createData;

  prisma.post.create = async ({ data }) => {
    createData = data;
    return samplePost(data);
  };

  const result = await service.create({
    name: '  Assistant Teacher  ',
    description: '  Primary education job  ',
  });

  assert.equal(result.success, true);
  assert.equal(createData.name, 'Assistant Teacher');
  assert.equal(createData.slug, 'assistant-teacher');
  assert.equal(createData.description, 'Primary education job');
});

// 03. Generate slug from Unicode name
test('create generates a slug from a Bengali name', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  let createData;

  prisma.post.create = async ({ data }) => {
    createData = data;
    return samplePost(data);
  };

  await service.create({
    name: 'সহকারী শিক্ষক',
  });

  assert.equal(createData.slug, 'সহকারী-শিক্ষক');
});

// 04. Reject duplicate name
test('create rejects an existing post name', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.post.findFirst = async () => ({ id: POST_ID });

  await assert.rejects(
    () => service.create({
      name: 'Assistant Teacher',
    }),
    ConflictException,
  );
});

// 05. Reject duplicate slug
test('create rejects an existing slug', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  let calls = 0;

  prisma.post.findFirst = async () => {
    calls += 1;
    return calls === 1 ? null : { id: POST_ID };
  };

  await assert.rejects(
    () => service.create({
      name: 'Assistant Teacher',
    }),
    ConflictException,
  );

  assert.equal(calls, 2);
});

// 06. Reject invalid generated slug
test('create rejects a slug that cannot be generated', async () => {
  const { service } = createService();

  await assert.rejects(
    () => service.create({
      name: '!!!',
    }),
    BadRequestException,
  );
});

// 07. Custom slug
test('create uses a normalized custom slug', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  let createData;

  prisma.post.create = async ({ data }) => {
    createData = data;
    return samplePost(data);
  };

  await service.create({
    name: 'Assistant Teacher',
    slug: '  Assistant Teacher Post  ',
  });

  assert.equal(createData.slug, 'assistant-teacher-post');
});

// 08. Find all defaults
test('findAll uses default pagination', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  let findManyArgs;

  prisma.post.findMany = async (args) => {
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

// 09. Maximum limit
test('findAll limits page size to 100', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  let findManyArgs;

  prisma.post.findMany = async (args) => {
    findManyArgs = args;
    return [];
  };

  const result = await service.findAll({
    page: 3,
    limit: 500,
  });

  assert.equal(result.pagination.page, 3);
  assert.equal(result.pagination.limit, 100);
  assert.equal(findManyArgs.skip, 200);
  assert.equal(findManyArgs.take, 100);
});

// 10. Minimum pagination values
test('findAll normalizes invalid pagination values', async () => {
  const { service } = createService();

  const result = await service.findAll({
    page: -5,
    limit: -10,
  });

  assert.equal(result.pagination.page, 1);
  assert.equal(result.pagination.limit, 1);
});

// 11. Search filter
test('findAll applies search across post fields', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  let findManyArgs;

  prisma.post.findMany = async (args) => {
    findManyArgs = args;
    return [];
  };

  await service.findAll({
    search: '  Teacher  ',
  });

  assert.equal(findManyArgs.where.OR.length, 3);
  assert.equal(
    findManyArgs.where.OR[0].name.contains,
    'Teacher',
  );
  assert.equal(
    findManyArgs.where.OR[1].slug.contains,
    'Teacher',
  );
  assert.equal(
    findManyArgs.where.OR[2].description.contains,
    'Teacher',
  );
});

// 12. Pagination total pages
test('findAll calculates total pages', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.post.count = async () => 45;

  const result = await service.findAll({
    page: 2,
    limit: 20,
  });

  assert.equal(result.pagination.total, 45);
  assert.equal(result.pagination.totalPages, 3);
});

// 13. Find one successfully
test('findOne returns post details', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.post.findUnique = async () => samplePost();

  const result = await service.findOne(POST_ID);

  assert.equal(result.success, true);
  assert.equal(result.data.id, POST_ID);
});

// 14. Find one missing
test('findOne throws when post does not exist', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.post.findUnique = async () => null;

  await assert.rejects(
    () => service.findOne(POST_ID),
    NotFoundException,
  );
});

// 15. Update without fields
test('update rejects an empty update request', async () => {
  const { service } = createService();

  await assert.rejects(
    () => service.update(POST_ID, {}),
    BadRequestException,
  );
});

// 16. Update missing post
test('update rejects a missing post', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.post.findUnique = async () => null;

  await assert.rejects(
    () => service.update(POST_ID, {
      description: 'Updated description',
    }),
    NotFoundException,
  );
});

// 17. Update empty name
test('update rejects an empty post name', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.post.findUnique = async () => samplePost();

  await assert.rejects(
    () => service.update(POST_ID, {
      name: '   ',
    }),
    BadRequestException,
  );
});

// 18. Update duplicate name
test('update rejects a duplicate post name', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.post.findUnique = async () => samplePost();

  prisma.post.findFirst = async () => ({ id: 'other-post-id' });

  await assert.rejects(
    () => service.update(POST_ID, {
      name: 'Another Post',
    }),
    ConflictException,
  );
});

// 19. Update description
test('update changes post description', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.post.findUnique = async () => samplePost();

  let updateArgs;

  prisma.post.update = async (args) => {
    updateArgs = args;
    return samplePost({
      description: 'Updated description',
    });
  };

  const result = await service.update(POST_ID, {
    description: '  Updated description  ',
  });

  assert.equal(result.success, true);
  assert.equal(
    updateArgs.data.description,
    'Updated description',
  );
});

// 20. Update name and generated slug
test('update changes name and generates slug', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.post.findUnique = async () => samplePost();

  let updateArgs;

  prisma.post.update = async (args) => {
    updateArgs = args;
    return samplePost();
  };

  await service.update(POST_ID, {
    name: 'Senior Assistant Teacher',
  });

  assert.equal(
    updateArgs.data.name,
    'Senior Assistant Teacher',
  );
  assert.equal(
    updateArgs.data.slug,
    'senior-assistant-teacher',
  );
});

// 21. Update custom slug
test('update normalizes a custom slug', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.post.findUnique = async () => samplePost();

  let updateArgs;

  prisma.post.update = async (args) => {
    updateArgs = args;
    return samplePost();
  };

  await service.update(POST_ID, {
    slug: '  New Post Slug  ',
  });

  assert.equal(updateArgs.data.slug, 'new-post-slug');
});

// 22. Update rejects invalid slug
test('update rejects an invalid slug', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.post.findUnique = async () => samplePost();

  await assert.rejects(
    () => service.update(POST_ID, {
      slug: '!!!',
    }),
    BadRequestException,
  );
});

// 23. Update rejects duplicate slug
test('update rejects an existing slug', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.post.findUnique = async () => samplePost();

  prisma.post.findFirst = async () => ({ id: 'another-post' });

  await assert.rejects(
    () => service.update(POST_ID, {
      slug: 'existing-slug',
    }),
    ConflictException,
  );
});

// 24. Remove with occurrences
test('remove rejects a post linked to question occurrences', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.post.findUnique = async () => samplePost({
    _count: {
      occurrences: 3,
    },
  });

  await assert.rejects(
    () => service.remove(POST_ID),
    BadRequestException,
  );
});

// 25. Remove missing post
test('remove rejects a missing post', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  prisma.post.findUnique = async () => null;

  await assert.rejects(
    () => service.remove(POST_ID),
    NotFoundException,
  );
});

// 26. Remove successfully
test('remove deletes a post without occurrences', async () => {
  const prisma = createPrisma();
  const { service } = createService(prisma);

  let deleted = false;

  prisma.post.findUnique = async () => samplePost();

  prisma.post.delete = async () => {
    deleted = true;
    return { id: POST_ID };
  };

  const result = await service.remove(POST_ID);

  assert.equal(result.success, true);
  assert.equal(deleted, true);
});
