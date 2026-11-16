"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Tab = "roles" | "permissions" | "assignments";

type Permission = {
  id: string;
  key: string;
  description?: string | null;
};

type RolePermission = {
  permission: Permission;
};

type Role = {
  id: string;
  name: string;
  description?: string | null;
  permissions: RolePermission[];
  _count?: {
    userRoles?: number;
    memberships?: number;
  };
};

type UserRole = {
  id: string;
  name: string;
};

type User = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  roles: UserRole[];
};

function messageFrom(payload: any, fallback: string) {
  const message = payload?.message;
  if (Array.isArray(message)) return message.join(", ");
  return typeof message === "string" ? message : fallback;
}

export default function AdminRolesPage() {
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">(
    "checking",
  );
  const [tab, setTab] = useState<Tab>("roles");

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [permissionKey, setPermissionKey] = useState("");
  const [permissionDescription, setPermissionDescription] = useState("");

  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedPermissionId, setSelectedPermissionId] = useState("");

  const [userSearch, setUserSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [assignmentRoleId, setAssignmentRoleId] = useState("");

  const [saving, setSaving] = useState(false);

  const request = useCallback(
    async (path: string, options?: RequestInit) => {
      const response = await fetch(`/api/admin/${path}`, {
        ...options,
        cache: "no-store",
        headers: {
          ...(options?.body ? { "Content-Type": "application/json" } : {}),
          ...options?.headers,
        },
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          messageFrom(payload, `Request failed (${response.status}).`),
        );
      }

      return payload;
    },
    [],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [roleData, permissionData] = await Promise.all([
        request("rbac/roles"),
        request("rbac/permissions"),
      ]);

      const nextRoles = Array.isArray(roleData)
        ? roleData
        : Array.isArray(roleData?.data)
          ? roleData.data
          : [];

      const nextPermissions = Array.isArray(permissionData)
        ? permissionData
        : Array.isArray(permissionData?.data)
          ? permissionData.data
          : [];

      setRoles(nextRoles);
      setPermissions(nextPermissions);

      setSelectedRoleId((current) =>
        nextRoles.some((role: Role) => role.id === current)
          ? current
          : nextRoles.find((role: Role) => role.name !== "SUPER_ADMIN")?.id ??
            "",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "RBAC data load করা যায়নি।",
      );
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    let active = true;

    async function verify() {
      try {
        const response = await fetch("/api/users/me", {
          cache: "no-store",
        });

        if (!response.ok) {
          if (active) setAccess("denied");
          return;
        }

        const payload = await response.json();
        const profile =
          payload?.data?.user ??
          payload?.data ??
          payload?.user ??
          payload;

        const roles = Array.isArray(profile?.roles) ? profile.roles : [];
        const allowed = roles.some(
          (role: string | UserRole) =>
            typeof role === "string"
              ? role === "SUPER_ADMIN"
              : role?.name === "SUPER_ADMIN",
        );

        if (active) setAccess(allowed ? "allowed" : "denied");
      } catch {
        if (active) setAccess("denied");
      }
    }

    verify();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (access === "allowed") loadData();
  }, [access, loadData]);

  const selectedRole = roles.find((role) => role.id === selectedRoleId);
  const isProtectedRole = selectedRole?.name === "SUPER_ADMIN";

  async function handleCreateRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await request("rbac/roles", {
        method: "POST",
        body: JSON.stringify({
          name: roleName.trim(),
          description: roleDescription.trim() || undefined,
        }),
      });

      setRoleName("");
      setRoleDescription("");
      setNotice("Role successfully created.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role তৈরি হয়নি।");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRole(role: Role) {
    if (role.name === "SUPER_ADMIN") return;

    if (
      !window.confirm(
        `Delete role "${role.name}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setError("");
    setNotice("");

    try {
      await request(`rbac/roles/${role.id}`, { method: "DELETE" });
      setNotice("Role deleted successfully.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role delete হয়নি।");
    }
  }

  async function handleCreatePermission(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await request("rbac/permissions", {
        method: "POST",
        body: JSON.stringify({
          key: permissionKey.trim(),
          description: permissionDescription.trim() || undefined,
        }),
      });

      setPermissionKey("");
      setPermissionDescription("");
      setNotice("Permission successfully created.");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Permission তৈরি হয়নি।",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeRolePermission(
    roleId: string,
    permissionId: string,
    assigned: boolean,
  ) {
    setError("");
    setNotice("");

    try {
      if (assigned) {
        await request(
          `rbac/roles/${roleId}/permissions/${permissionId}`,
          { method: "DELETE" },
        );
        setNotice("Permission removed from role.");
      } else {
        await request(`rbac/roles/${roleId}/permissions`, {
          method: "POST",
          body: JSON.stringify({ permissionId }),
        });
        setNotice("Permission assigned to role.");
      }

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Permission update করা যায়নি।",
      );
    }
  }

  async function searchUsers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setUsers([]);
    setSelectedUserId("");

    if (userSearch.trim().length < 2) {
      setError("কমপক্ষে ২ অক্ষর দিয়ে user search করো।");
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams({
        search: userSearch.trim(),
        status: "ACTIVE",
        page: "1",
        limit: "50",
      });

      const payload = await request(`users?${params.toString()}`);
      const rows = Array.isArray(payload?.data) ? payload.data : [];

      setUsers(rows);
      if (rows.length === 0) setNotice("কোনো ACTIVE user পাওয়া যায়নি।");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "User search করা যায়নি।",
      );
    } finally {
      setLoading(false);
    }
  }

  async function assignUserRole() {
    if (!selectedUserId || !assignmentRoleId) {
      setError("User এবং Role নির্বাচন করো।");
      return;
    }

    const targetRole = roles.find((role) => role.id === assignmentRoleId);
    if (!targetRole || targetRole.name === "SUPER_ADMIN") {
      setError("SUPER_ADMIN role সাধারণ API দিয়ে assign করা যাবে না।");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await request(`rbac/users/${selectedUserId}/roles`, {
        method: "POST",
        body: JSON.stringify({ roleId: assignmentRoleId }),
      });

      setNotice("Role assigned successfully.");
      await searchUsers(
        new Event("submit") as unknown as FormEvent<HTMLFormElement>,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Role assign করা যায়নি।",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeUserRole(user: User, role: UserRole) {
    if (role.name === "SUPER_ADMIN") return;

    if (
      !window.confirm(
        `Remove ${role.name} role from ${user.name}?`,
      )
    ) {
      return;
    }

    setError("");
    setNotice("");

    try {
      await request(`rbac/users/${user.id}/roles/${role.id}`, {
        method: "DELETE",
      });

      setNotice(`${role.name} role removed from ${user.name}.`);

      const params = new URLSearchParams({
        search: userSearch.trim(),
        status: "ACTIVE",
        page: "1",
        limit: "50",
      });

      const payload = await request(`users?${params.toString()}`);
      setUsers(Array.isArray(payload?.data) ? payload.data : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Role remove করা যায়নি।",
      );
    }
  }

  if (access === "checking") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-600">Permission যাচাই করা হচ্ছে...</p>
      </div>
    );
  }

  if (access === "denied") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8">
        <h1 className="text-xl font-bold text-slate-900">Access restricted</h1>
        <p className="mt-2 text-sm text-slate-600">
          এই পেজ ব্যবহারের জন্য Super Admin permission প্রয়োজন।
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
          Security & Access Control
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Roles & Permissions
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Role তৈরি, permission নিয়ন্ত্রণ এবং user access পরিচালনা করো।
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {([
            ["roles", "Role Management"],
            ["permissions", "Permission Management"],
            ["assignments", "User Role Assignment"],
          ] as [Tab, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTab(value);
                setError("");
                setNotice("");
              }}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                tab === value
                  ? "bg-emerald-700 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {(error || notice) && (
        <div className="space-y-2">
          {error && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {notice && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {notice}
            </div>
          )}
        </div>
      )}

      {tab === "roles" && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Create New Role</h2>
            <form onSubmit={handleCreateRole} className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                required
                minLength={2}
                maxLength={80}
                value={roleName}
                onChange={(event) => setRoleName(event.target.value)}
                placeholder="Role name (e.g. CONTENT_MANAGER)"
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
              <input
                maxLength={500}
                value={roleDescription}
                onChange={(event) => setRoleDescription(event.target.value)}
                placeholder="Role description (optional)"
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
              <button
                disabled={saving}
                className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 md:col-span-2"
              >
                {saving ? "Creating..." : "Create Role"}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold text-slate-900">Existing Roles</h2>
              <button
                type="button"
                onClick={loadData}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <p className="py-8 text-center text-sm text-slate-500">Loading...</p>
            ) : (
              <div className="mt-4 space-y-3">
                {roles.map((role) => (
                  <div key={role.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{role.name}</h3>
                          {role.name === "SUPER_ADMIN" && (
                            <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                              Protected system role
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {role.description || "No description"}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          {role.permissions?.length ?? 0} permissions ·{" "}
                          {role._count?.userRoles ?? 0} users ·{" "}
                          {role._count?.memberships ?? 0} memberships
                        </p>
                      </div>

                      {role.name !== "SUPER_ADMIN" && (
                        <button
                          type="button"
                          onClick={() => deleteRole(role)}
                          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                        >
                          Delete Role
                        </button>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {(role.permissions ?? []).map((item) => (
                        <span
                          key={item.permission.id}
                          className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700"
                        >
                          {item.permission.key}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {roles.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-500">No roles found.</p>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {tab === "permissions" && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Create Permission</h2>
            <p className="mt-1 text-xs text-slate-500">
              Format: module.action (e.g. reports.read)
            </p>
            <form onSubmit={handleCreatePermission} className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                required
                maxLength={120}
                pattern="[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+"
                value={permissionKey}
                onChange={(event) => setPermissionKey(event.target.value)}
                placeholder="permission.key"
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
              <input
                maxLength={500}
                value={permissionDescription}
                onChange={(event) => setPermissionDescription(event.target.value)}
                placeholder="Description (optional)"
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
              <button
                disabled={saving}
                className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 md:col-span-2"
              >
                {saving ? "Creating..." : "Create Permission"}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Assign Permissions to Role</h2>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <select
                value={selectedRoleId}
                onChange={(event) => setSelectedRoleId(event.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
              >
                <option value="">Select role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>

              <select
                value={selectedPermissionId}
                onChange={(event) => setSelectedPermissionId(event.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
              >
                <option value="">Select permission</option>
                {permissions.map((permission) => (
                  <option key={permission.id} value={permission.id}>
                    {permission.key}
                  </option>
                ))}
              </select>
            </div>

            {isProtectedRole && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                SUPER_ADMIN permissions are protected and cannot be changed here.
              </p>
            )}

            <button
              type="button"
              disabled={!selectedRoleId || !selectedPermissionId || isProtectedRole}
              onClick={() => {
                const assigned = selectedRole?.permissions?.some(
                  (item) => item.permission.id === selectedPermissionId,
                ) ?? false;

                changeRolePermission(
                  selectedRoleId,
                  selectedPermissionId,
                  assigned,
                );
              }}
              className="mt-3 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {selectedRole?.permissions?.some(
                (item) => item.permission.id === selectedPermissionId,
              )
                ? "Remove Permission"
                : "Assign Permission"}
            </button>

            {selectedRole && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold text-slate-800">
                  Permissions: {selectedRole.name}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedRole.permissions?.map((item) => (
                    <span key={item.permission.id} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      {item.permission.key}
                    </span>
                  ))}
                  {!selectedRole.permissions?.length && (
                    <span className="text-sm text-slate-500">No permissions assigned.</span>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">
              Permission Registry ({permissions.length})
            </h2>
            <div className="mt-4 divide-y divide-slate-100">
              {permissions.map((permission) => (
                <div key={permission.id} className="py-3">
                  <p className="text-sm font-semibold text-slate-800">{permission.key}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {permission.description || "No description"}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {tab === "assignments" && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Find Active User</h2>
            <p className="mt-1 text-sm text-slate-500">
              Name, email অথবা phone দিয়ে search করো।
            </p>
            <form onSubmit={searchUsers} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Search active users..."
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
              <button
                disabled={loading}
                className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                Search Users
              </button>
            </form>
          </section>

          {users.map((user) => (
            <section key={user.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">{user.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {user.email || "No email"} · {user.phone || "No phone"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{user.id}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {user.status}
                </span>
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Assigned roles
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {user.roles?.map((role) => (
                    <span key={role.id} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-800">
                      {role.name}
                      {role.name !== "SUPER_ADMIN" && (
                        <button
                          type="button"
                          onClick={() => removeUserRole(user, role)}
                          className="font-bold text-red-600 hover:text-red-800"
                          title="Remove role"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                  {!user.roles?.length && (
                    <span className="text-xs text-slate-400">No roles assigned</span>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <select
                  value={selectedUserId === user.id ? assignmentRoleId : ""}
                  onChange={(event) => {
                    setSelectedUserId(user.id);
                    setAssignmentRoleId(event.target.value);
                  }}
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm"
                >
                  <option value="">Select role to assign</option>
                  {roles
                    .filter((role) => role.name !== "SUPER_ADMIN")
                    .filter(
                      (role) =>
                        !user.roles?.some(
                          (assigned) => assigned.id === role.id,
                        ),
                    )
                    .map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={
                    saving ||
                    selectedUserId !== user.id ||
                    !assignmentRoleId
                  }
                  onClick={assignUserRole}
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving && selectedUserId === user.id ? "Saving..." : "Assign Role"}
                </button>
              </div>
            </section>
          ))}

          {users.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              User search করে result এখানে দেখো।
            </div>
          )}
        </>
      )}
    </div>
  );
}
