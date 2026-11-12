const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BadRequestException,
  ConflictException,
  NotFoundException,
} = require('@nestjs/common');

const { TagsService } = require('../dist/modules/tags/tags.service');

function createMocks(options = {}) {
  const questionTag = {
    create: options.tagCreate ?? (async ({ data }) => ({
      id: 'tag-1',
      ...data,
    })),

    findMany: options.tagFindMany ?? (async () => []),

    findUnique: options.tagFindUnique ?? (async () => ({
      id: 'tag-1',
      name: 'Science',
      slug: 'science',
    })),

    count: options.tagCount ?? (async () => 0),

    update: options.tagUpdate ?? (async ({ data }) => ({
      id: 'tag-1',
      ...data,
    })),

    delete: options.tagDelete ?? (async () => ({
      id: 'tag-1',
    })),
  };

  const question = {
    findFirst: options.questionFindFirst ?? (async () => ({
      id: 'question-1',
      deletedAt: null,
    })),

    findUnique: options.questionFindUnique ?? (async () => ({
      id: 'question-1',
      tags: [],
    })),

    findMany: options.questionFindMany ?? (async () => []),

    count: options.questionCount ?? (async () => 0),
  };

  const questionTagLink = {
    deleteMany: options.linkDeleteMany ?? (async () => ({
      count: 0,
    })),

    createMany: options.linkCreateMany ?? (async () => ({
      count: 0,
    })),
  };

  const prisma = {
    questionTag,
    question,
    questionTagLink,

    $transaction: async (arg) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }

      return arg({
        questionTag,
        question,
        questionTagLink,
      });
    },
  };

  return {
    service: new TagsService(prisma),
    prisma,
    questionTag,
    question,
    questionTagLink,
  };
}

function isException(Type) {
  return (error) => error instanceof Type;
}

// =====================================================
// CREATE
// =====================================================

test('create creates tag successfully', async () => {
  const { service } = createMocks();

  const result = await service.create({
    name: 'Science',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.name, 'Science');
  assert.equal(result.data.slug, 'science');
});

test('create trims tag name', async () => {
  let receivedData;

  const { service } = createMocks({
    tagCreate: async ({ data }) => {
      receivedData = data;
      return { id: 'tag-1', ...data };
    },
  });

  await service.create({
    name: '  Science  ',
  });

  assert.equal(receivedData.name, 'Science');
});

test('create generates slug from tag name', async () => {
  let receivedData;

  const { service } = createMocks({
    tagCreate: async ({ data }) => {
      receivedData = data;
      return { id: 'tag-1', ...data };
    },
  });

  await service.create({
    name: 'General Knowledge',
  });

  assert.equal(receivedData.slug, 'general-knowledge');
});

test('create generates slug from explicit slug when supplied', async () => {
  let receivedData;

  const { service } = createMocks({
    tagCreate: async ({ data }) => {
      receivedData = data;
      return { id: 'tag-1', ...data };
    },
  });

  await service.create({
    name: 'General Knowledge',
    slug: '  GK-Questions  ',
  });

  assert.equal(receivedData.slug, 'GK-Questions');
});

test('create rejects missing tag name', async () => {
  const { service } = createMocks();

  await assert.rejects(
    service.create({}),
    isException(BadRequestException),
  );
});

test('create rejects empty tag name', async () => {
  const { service } = createMocks();

  await assert.rejects(
    service.create({ name: '   ' }),
    isException(BadRequestException),
  );
});

test('create converts duplicate error P2002 to ConflictException', async () => {
  const { service } = createMocks({
    tagCreate: async () => {
      throw { code: 'P2002' };
    },
  });

  await assert.rejects(
    service.create({ name: 'Science' }),
    isException(ConflictException),
  );
});

test('create rethrows unexpected database errors', async () => {
  const databaseError = new Error('Database unavailable');

  const { service } = createMocks({
    tagCreate: async () => {
      throw databaseError;
    },
  });

  await assert.rejects(
    service.create({ name: 'Science' }),
    (error) => error === databaseError,
  );
});

// =====================================================
// FIND ALL
// =====================================================

test('findAll returns tags with pagination', async () => {
  const tags = [{ id: 'tag-1', name: 'Science' }];

  const { service } = createMocks({
    tagFindMany: async () => tags,
    tagCount: async () => 21,
  });

  const result = await service.findAll({
    page: 2,
    limit: 10,
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.data, tags);
  assert.equal(result.meta.page, 2);
  assert.equal(result.meta.limit, 10);
  assert.equal(result.meta.total, 21);
  assert.equal(result.meta.totalPages, 3);
});

test('findAll uses default pagination values', async () => {
  const { service } = createMocks();

  const result = await service.findAll({});

  assert.equal(result.meta.page, 1);
  assert.equal(result.meta.limit, 20);
});

test('findAll prevents page below one', async () => {
  const { service } = createMocks();

  const result = await service.findAll({
    page: -5,
    limit: 10,
  });

  assert.equal(result.meta.page, 1);
});

test('findAll limits maximum page size to 100', async () => {
  const { service } = createMocks();

  const result = await service.findAll({
    page: 1,
    limit: 500,
  });

  assert.equal(result.meta.limit, 100);
});

test('findAll applies trimmed search filter', async () => {
  let receivedWhere;

  const { service } = createMocks({
    tagFindMany: async ({ where }) => {
      receivedWhere = where;
      return [];
    },
  });

  await service.findAll({
    search: '  Science  ',
  });

  assert.deepEqual(receivedWhere, {
    OR: [
      {
        name: {
          contains: 'Science',
          mode: 'insensitive',
        },
      },
      {
        slug: {
          contains: 'Science',
          mode: 'insensitive',
        },
      },
    ],
  });
});

test('findAll uses empty filter when search is empty', async () => {
  let receivedWhere;

  const { service } = createMocks({
    tagFindMany: async ({ where }) => {
      receivedWhere = where;
      return [];
    },
  });

  await service.findAll({
    search: '   ',
  });

  assert.deepEqual(receivedWhere, {});
});

test('findAll orders tags by name ascending', async () => {
  let receivedArgs;

  const { service } = createMocks({
    tagFindMany: async (args) => {
      receivedArgs = args;
      return [];
    },
  });

  await service.findAll({});

  assert.deepEqual(receivedArgs.orderBy, {
    name: 'asc',
  });

  assert.deepEqual(receivedArgs.include, {
    _count: {
      select: {
        questions: true,
      },
    },
  });
});

// =====================================================
// FIND ONE
// =====================================================

test('findOne returns tag details', async () => {
  const tag = {
    id: 'tag-1',
    name: 'Science',
    slug: 'science',
    _count: {
      questions: 5,
    },
  };

  const { service } = createMocks({
    tagFindUnique: async () => tag,
  });

  const result = await service.findOne('tag-1');

  assert.equal(result.success, true);
  assert.deepEqual(result.data, tag);
});

test('findOne rejects missing tag', async () => {
  const { service } = createMocks({
    tagFindUnique: async () => null,
  });

  await assert.rejects(
    service.findOne('missing-tag'),
    isException(NotFoundException),
  );
});

// =====================================================
// UPDATE
// =====================================================

test('update changes tag name successfully', async () => {
  let receivedData;

  const { service } = createMocks({
    tagUpdate: async ({ data }) => {
      receivedData = data;
      return {
        id: 'tag-1',
        ...data,
      };
    },
  });

  const result = await service.update('tag-1', {
    name: '  Mathematics  ',
  });

  assert.equal(result.success, true);
  assert.equal(receivedData.name, 'Mathematics');
});

test('update changes tag slug successfully', async () => {
  let receivedData;

  const { service } = createMocks({
    tagUpdate: async ({ data }) => {
      receivedData = data;
      return { id: 'tag-1', ...data };
    },
  });

  await service.update('tag-1', {
    slug: '  math-questions  ',
  });

  assert.equal(receivedData.slug, 'math-questions');
});

test('update changes both name and slug', async () => {
  let receivedData;

  const { service } = createMocks({
    tagUpdate: async ({ data }) => {
      receivedData = data;
      return { id: 'tag-1', ...data };
    },
  });

  await service.update('tag-1', {
    name: ' Mathematics ',
    slug: ' math ',
  });

  assert.deepEqual(receivedData, {
    name: 'Mathematics',
    slug: 'math',
  });
});

test('update rejects missing tag', async () => {
  const { service } = createMocks({
    tagFindUnique: async () => null,
  });

  await assert.rejects(
    service.update('missing-tag', {
      name: 'Science',
    }),
    isException(NotFoundException),
  );
});

test('update rejects empty tag name', async () => {
  const { service } = createMocks();

  await assert.rejects(
    service.update('tag-1', {
      name: '   ',
    }),
    isException(BadRequestException),
  );
});

test('update rejects empty tag slug', async () => {
  const { service } = createMocks();

  await assert.rejects(
    service.update('tag-1', {
      slug: '   ',
    }),
    isException(BadRequestException),
  );
});

test('update converts duplicate error P2002 to ConflictException', async () => {
  const { service } = createMocks({
    tagUpdate: async () => {
      throw { code: 'P2002' };
    },
  });

  await assert.rejects(
    service.update('tag-1', {
      name: 'Existing Tag',
    }),
    isException(ConflictException),
  );
});

test('update allows empty update data', async () => {
  let receivedData;

  const { service } = createMocks({
    tagUpdate: async ({ data }) => {
      receivedData = data;
      return { id: 'tag-1', ...data };
    },
  });

  const result = await service.update('tag-1', {});

  assert.equal(result.success, true);
  assert.deepEqual(receivedData, {});
});

// =====================================================
// REMOVE
// =====================================================

test('remove deletes existing tag', async () => {
  let receivedWhere;

  const { service } = createMocks({
    tagDelete: async ({ where }) => {
      receivedWhere = where;
      return { id: 'tag-1' };
    },
  });

  const result = await service.remove('tag-1');

  assert.deepEqual(receivedWhere, {
    id: 'tag-1',
  });

  assert.equal(result.success, true);
  assert.equal(result.message, 'Tag deleted successfully.');
});

test('remove rejects missing tag', async () => {
  const { service } = createMocks({
    tagFindUnique: async () => null,
  });

  await assert.rejects(
    service.remove('missing-tag'),
    isException(NotFoundException),
  );
});

test('remove propagates database delete error', async () => {
  const databaseError = new Error('Delete failed');

  const { service } = createMocks({
    tagDelete: async () => {
      throw databaseError;
    },
  });

  await assert.rejects(
    service.remove('tag-1'),
    (error) => error === databaseError,
  );
});

// =====================================================
// ASSIGN TAGS TO QUESTION
// =====================================================

test('assignToQuestion assigns multiple tags successfully', async () => {
  let receivedDeleteWhere;
  let receivedCreateData;

  const { service } = createMocks({
    tagFindMany: async () => [
      { id: 'tag-1' },
      { id: 'tag-2' },
    ],

    linkDeleteMany: async ({ where }) => {
      receivedDeleteWhere = where;
      return { count: 0 };
    },

    linkCreateMany: async ({ data }) => {
      receivedCreateData = data;
      return { count: data.length };
    },
  });

  const result = await service.assignToQuestion('question-1', {
    tagIds: ['tag-1', 'tag-2'],
  });

  assert.equal(result.success, true);

  assert.deepEqual(receivedDeleteWhere, {
    questionId: 'question-1',
  });

  assert.deepEqual(receivedCreateData, [
    {
      questionId: 'question-1',
      tagId: 'tag-1',
    },
    {
      questionId: 'question-1',
      tagId: 'tag-2',
    },
  ]);
});

test('assignToQuestion removes duplicate tag IDs', async () => {
  let receivedCreateData;

  const { service } = createMocks({
    tagFindMany: async () => [
      { id: 'tag-1' },
      { id: 'tag-2' },
    ],

    linkCreateMany: async ({ data }) => {
      receivedCreateData = data;
      return { count: data.length };
    },
  });

  await service.assignToQuestion('question-1', {
    tagIds: ['tag-1', 'tag-1', 'tag-2'],
  });

  assert.equal(receivedCreateData.length, 2);
});

test('assignToQuestion rejects missing or deleted question', async () => {
  const { service } = createMocks({
    questionFindFirst: async () => null,
  });

  await assert.rejects(
    service.assignToQuestion('missing-question', {
      tagIds: ['tag-1'],
    }),
    isException(NotFoundException),
  );
});

test('assignToQuestion rejects non-array tagIds', async () => {
  const { service } = createMocks();

  await assert.rejects(
    service.assignToQuestion('question-1', {
      tagIds: 'tag-1',
    }),
    isException(BadRequestException),
  );
});

test('assignToQuestion rejects invalid tag IDs', async () => {
  const { service } = createMocks({
    tagFindMany: async () => [
      { id: 'tag-1' },
    ],
  });

  await assert.rejects(
    service.assignToQuestion('question-1', {
      tagIds: ['tag-1', 'tag-2'],
    }),
    isException(BadRequestException),
  );
});

test('assignToQuestion removes all tags when empty array is supplied', async () => {
  let createManyCalled = false;
  let deleteManyCalled = false;

  const { service } = createMocks({
    linkDeleteMany: async () => {
      deleteManyCalled = true;
      return { count: 2 };
    },

    linkCreateMany: async () => {
      createManyCalled = true;
      return { count: 0 };
    },
  });

  const result = await service.assignToQuestion('question-1', {
    tagIds: [],
  });

  assert.equal(result.success, true);
  assert.equal(deleteManyCalled, true);
  assert.equal(createManyCalled, false);
});

test('assignToQuestion returns updated question with tags', async () => {
  const updatedQuestion = {
    id: 'question-1',
    tags: [
      {
        tag: {
          id: 'tag-1',
          name: 'Science',
        },
      },
    ],
  };

  const { service } = createMocks({
    tagFindMany: async () => [
      {
        id: 'tag-1',
        name: 'Science',
        slug: 'science',
      },
    ],

    questionFindUnique: async () => updatedQuestion,
  });

  const result = await service.assignToQuestion('question-1', {
    tagIds: ['tag-1'],
  });

  assert.deepEqual(result.data, updatedQuestion);
});

// =====================================================
// SEARCH QUESTIONS
// =====================================================

test('searchQuestions returns questions with pagination', async () => {
  const questions = [
    {
      id: 'question-1',
      questionText: 'What is science?',
    },
  ];

  const { service } = createMocks({
    questionFindMany: async () => questions,
    questionCount: async () => 21,
  });

  const result = await service.searchQuestions({
    page: 2,
    limit: 10,
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.data, questions);
  assert.equal(result.meta.page, 2);
  assert.equal(result.meta.limit, 10);
  assert.equal(result.meta.total, 21);
  assert.equal(result.meta.totalPages, 3);
});

test('searchQuestions uses default pagination values', async () => {
  const { service } = createMocks();

  const result = await service.searchQuestions({});

  assert.equal(result.meta.page, 1);
  assert.equal(result.meta.limit, 20);
});

test('searchQuestions limits maximum page size to 100', async () => {
  const { service } = createMocks();

  const result = await service.searchQuestions({
    page: 1,
    limit: 500,
  });

  assert.equal(result.meta.limit, 100);
});

test('searchQuestions always excludes deleted questions', async () => {
  let receivedWhere;

  const { service } = createMocks({
    questionFindMany: async ({ where }) => {
      receivedWhere = where;
      return [];
    },
  });

  await service.searchQuestions({});

  assert.equal(receivedWhere.deletedAt, null);
});

test('searchQuestions applies question text search', async () => {
  let receivedWhere;

  const { service } = createMocks({
    questionFindMany: async ({ where }) => {
      receivedWhere = where;
      return [];
    },
  });

  await service.searchQuestions({
    search: '  Bangladesh  ',
  });

  assert.deepEqual(receivedWhere.AND, [
    {
      questionText: {
        contains: 'Bangladesh',
        mode: 'insensitive',
      },
    },
  ]);
});

test('searchQuestions applies tag name and slug search', async () => {
  let receivedWhere;

  const { service } = createMocks({
    questionFindMany: async ({ where }) => {
      receivedWhere = where;
      return [];
    },
  });

  await service.searchQuestions({
    tag: '  Science  ',
  });

  assert.deepEqual(receivedWhere.AND, [
    {
      tags: {
        some: {
          tag: {
            OR: [
              {
                name: {
                  contains: 'Science',
                  mode: 'insensitive',
                },
              },
              {
                slug: {
                  contains: 'Science',
                  mode: 'insensitive',
                },
              },
            ],
          },
        },
      },
    },
  ]);
});

test('searchQuestions applies ANY matching for multiple tag IDs', async () => {
  let receivedWhere;

  const { service } = createMocks({
    questionFindMany: async ({ where }) => {
      receivedWhere = where;
      return [];
    },
  });

  await service.searchQuestions({
    tagIds: 'tag-1,tag-2,tag-3',
  });

  assert.deepEqual(receivedWhere.AND, [
    {
      tags: {
        some: {
          tagId: {
            in: ['tag-1', 'tag-2', 'tag-3'],
          },
        },
      },
    },
  ]);
});

test('searchQuestions applies ALL matching for multiple tag IDs', async () => {
  let receivedWhere;

  const { service } = createMocks({
    questionFindMany: async ({ where }) => {
      receivedWhere = where;
      return [];
    },
  });

  await service.searchQuestions({
    tagIds: 'tag-1,tag-2',
    matchMode: 'ALL',
  });

  assert.deepEqual(receivedWhere.AND, [
    {
      tags: {
        some: {
          tagId: 'tag-1',
        },
      },
    },
    {
      tags: {
        some: {
          tagId: 'tag-2',
        },
      },
    },
  ]);
});

test('searchQuestions removes duplicate and empty tag IDs', async () => {
  let receivedWhere;

  const { service } = createMocks({
    questionFindMany: async ({ where }) => {
      receivedWhere = where;
      return [];
    },
  });

  await service.searchQuestions({
    tagIds: 'tag-1,tag-1,,tag-2, ',
  });

  assert.deepEqual(receivedWhere.AND, [
    {
      tags: {
        some: {
          tagId: {
            in: ['tag-1', 'tag-2'],
          },
        },
      },
    },
  ]);
});

test('searchQuestions combines text, tag and tag ID filters', async () => {
  let receivedWhere;

  const { service } = createMocks({
    questionFindMany: async ({ where }) => {
      receivedWhere = where;
      return [];
    },
  });

  await service.searchQuestions({
    search: 'Bangladesh',
    tag: 'Science',
    tagIds: 'tag-1,tag-2',
  });

  assert.equal(receivedWhere.deletedAt, null);
  assert.equal(receivedWhere.AND.length, 3);
});

test('searchQuestions uses expected relations and ordering', async () => {
  let receivedArgs;

  const { service } = createMocks({
    questionFindMany: async (args) => {
      receivedArgs = args;
      return [];
    },
  });

  await service.searchQuestions({});

  assert.deepEqual(receivedArgs.orderBy, {
    createdAt: 'desc',
  });

  assert.deepEqual(receivedArgs.include, {
    options: {
      orderBy: {
        sortOrder: 'asc',
      },
    },
    occurrences: true,
    tags: {
      include: {
        tag: true,
      },
    },
  });
});