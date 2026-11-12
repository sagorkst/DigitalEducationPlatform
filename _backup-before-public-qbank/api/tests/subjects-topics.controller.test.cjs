const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SubjectsController,
} = require('../dist/modules/subjects/subjects.controller');

const {
  TopicsController,
} = require('../dist/modules/subjects/topics.controller');

function checkController(controller, permission) {
  const prototype = controller.prototype;

  for (const method of ['findAll', 'findOne']) {
    const guards = Reflect.getMetadata(
      '__guards__',
      prototype[method],
    );

    assert.equal(
      guards,
      undefined,
      `${method} must remain public`,
    );
  }

  for (const method of ['create', 'update', 'remove']) {
    const guards = Reflect.getMetadata(
      '__guards__',
      prototype[method],
    );

    const permissions = Reflect.getMetadata(
      'required_permissions',
      prototype[method],
    );

    assert.ok(
      Array.isArray(guards) && guards.length === 2,
      `${method} must use JwtAuthGuard and PermissionsGuard`,
    );

    assert.deepEqual(permissions, [permission]);
  }
}

test('01 - Subject GET APIs are public and write APIs require subjects.manage', () => {
  checkController(SubjectsController, 'subjects.manage');
});

test('02 - Topic GET APIs are public and write APIs require topics.manage', () => {
  checkController(TopicsController, 'topics.manage');
});
