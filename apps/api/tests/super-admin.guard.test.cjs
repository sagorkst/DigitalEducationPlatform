const test = require('node:test');
const assert = require('node:assert/strict');

const { ForbiddenException } = require('@nestjs/common');
const {
  SuperAdminGuard,
} = require('../dist/modules/rbac/super-admin.guard');

function contextWithRoles(roles) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: { roles },
      }),
    }),
  };
}

test('01 - Allows SUPER_ADMIN object role from JwtAuthGuard', () => {
  const guard = new SuperAdminGuard();

  assert.equal(
    guard.canActivate(
      contextWithRoles([
        { id: 'role-1', name: 'USER' },
        { id: 'role-2', name: 'SUPER_ADMIN' },
      ]),
    ),
    true,
  );
});

test('02 - Allows SUPER_ADMIN string role', () => {
  const guard = new SuperAdminGuard();

  assert.equal(
    guard.canActivate(contextWithRoles(['SUPER_ADMIN'])),
    true,
  );
});

test('03 - Rejects ADMIN', () => {
  const guard = new SuperAdminGuard();

  assert.throws(
    () =>
      guard.canActivate(
        contextWithRoles([{ id: 'role-1', name: 'ADMIN' }]),
      ),
    ForbiddenException,
  );
});

test('04 - Rejects USER', () => {
  const guard = new SuperAdminGuard();

  assert.throws(
    () =>
      guard.canActivate(
        contextWithRoles([{ id: 'role-1', name: 'USER' }]),
      ),
    ForbiddenException,
  );
});

test('05 - Rejects missing roles', () => {
  const guard = new SuperAdminGuard();

  assert.throws(
    () =>
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ user: {} }),
        }),
      }),
    ForbiddenException,
  );
});