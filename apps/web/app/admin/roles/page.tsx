"use client";

import { useCallback, useEffect, useState } from "react";

type Permission = {
  id: string;
  key: string;
  description?: string | null;
};

type Role = {
  id: string;
  name: string;
  description?: string | null;
  permissions?: Array<{ permission?: Permission } | Permission>;
  _count?: {
    userRoles?: number;
    memberships?: number;
  };
};

function unwrap(value: any): any {
  let result = value;
  for (let i = 0; i < 4 && result && !Array.isArray(result) && result.data !== undefined; i++) {
    result = result.data;
  }
  return result;
}

function getError(payload: any, fallback: string): string {
  if (typeof payload?.message === "string") return payload.message;
  if (Array.isArray(payload?.message)) return payload.message.join(", ");
  return fallback;
}

export default function AdminRolesPage() {
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedPermissionId, setSelectedPermissionId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const request = useCallback(async (url: string, options?: RequestInit) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(getError(payload, "Request failed."));
    return unwrap(payload);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [roleResult, permissionResult] = await Promise.all([
        request("/api/admin/rbac/roles"),
        request("/api/admin/rbac/permissions"),
      ]);

      const roleRows = Array.isArray(roleResult)
        ? roleResult
        : Array.isArray(roleResult?.roles) ? roleResult.roles : [];
      const permissionRows = Array.isArray(permissionResult)
        ? permissionResult
        : Array.isArray(permissionResult?.permissions) ? permissionResult.permissions : [];

      setRoles(roleRows);
      setPermissions(permissionRows);
      setSelectedRoleId((current) =>
        roleRows.some((role: Role) => role.id === current)
          ? current
          : roleRows[0]?.id || ""
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load RBAC data.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    let active = true;
    fetch("/api/users/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        const user = payload?.data ?? payload;
        const userRoles = Array.isArray(user?.roles) ? user.roles : [];
        const isSuperAdmin = userRoles.some((role: any) =>
          (typeof role === "string" ? role : role?.name) === "SUPER_ADMIN"
        );
        if (active) {
          setAllowed(isSuperAdmin);
          setChecking(false);
          if (isSuperAdmin) void loadData();
        }
      })
      .catch(() => {
        if (active) setChecking(false);
      });
    return () => { active = false; };
  }, [loadData]);

  const selectedRole = roles.find((role) => role.id === selectedRoleId);
  const assignedPermissions = (selectedRole?.permissions || []).map((item) =>
    "permission" in item ? item.permission : item
  ).filter((item): item is Permission => Boolean(item));

  async function createRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      await request("/api/admin/rbac/roles", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });
      setName("");
      setDescription("");
      setNotice("Role created successfully.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role creation failed.");
    }
  }

  async function deleteRole(role: Role) {
    if (role.name === "SUPER_ADMIN") return;
    if (!window.confirm(`Delete role "${role.name}"?`)) return;
    setError("");
    setNotice("");
    try {
      await request(`/api/admin/rbac/roles/${role.id}`, { method: "DELETE" });
      setNotice("Role deleted successfully.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role deletion failed.");
    }
  }

  async function addPermission() {
    if (!selectedRoleId || !selectedPermissionId) return;
    setError("");
    setNotice("");
    try {
      await request(`/api/admin/rbac/roles/${selectedRoleId}/permissions`, {
        method: "POST",
        body: JSON.stringify({ permissionId: selectedPermissionId }),
      });
      setSelectedPermissionId("");
      setNotice("Permission assigned to role.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Permission assignment failed.");
    }
  }

  async function removePermission(permissionId: string) {
    if (!selectedRoleId) return;
    setError("");
    setNotice("");
    try {
      await request(`/api/admin/rbac/roles/${selectedRoleId}/permissions/${permissionId}`, {
        method: "DELETE",
      });
      setNotice("Permission removed from role.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Permission removal failed.");
    }
  }

  if (checking) return <div className="rounded-2xl bg-white p-8">Checking access...</div>;
  if (!allowed) return <div className="rounded-2xl border border-red-200 bg-white p-8 text-red-700">Access denied. SUPER_ADMIN only.</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-emerald-700">ACCESS CONTROL</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Role Management</h1>
        <p className="mt-2 text-sm text-slate-500">Create roles and manage the permissions assigned to each role.</p>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Create Role</h2>
        <form onSubmit={createRole} className="mt-4 grid gap-3 md:grid-cols-3">
          <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={80} placeholder="Role name (e.g. CONTENT_MANAGER)" className="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
          <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="Description (optional)" className="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
          <button disabled={loading} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">Create Role</button>
        </form>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Roles ({roles.length})</h2>
            <button onClick={() => void loadData()} className="text-sm font-medium text-emerald-700">Refresh</button>
          </div>
          <div className="mt-4 space-y-2">
            {roles.map((role) => (
              <div key={role.id} className={`rounded-xl border p-3 ${selectedRoleId === role.id ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`}>
                <div className="flex items-center justify-between gap-2">
                  <button onClick={() => setSelectedRoleId(role.id)} className="min-w-0 flex-1 text-left">
                    <span className="block break-all text-sm font-semibold text-slate-900">{role.name}</span>
                    <span className="mt-1 block text-xs text-slate-500">{role._count?.userRoles ?? 0} assigned users · {role._count?.memberships ?? 0} memberships</span>
                  </button>
                  {role.name !== "SUPER_ADMIN" && (
                    <button onClick={() => void deleteRole(role)} className="rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">Delete</button>
                  )}
                </div>
                {role.description && <p className="mt-2 text-xs text-slate-500">{role.description}</p>}
              </div>
            ))}
            {!roles.length && <p className="text-sm text-slate-500">No roles found.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Role Permissions</h2>
          {!selectedRole ? (
            <p className="mt-4 text-sm text-slate-500">Select a role to manage its permissions.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-500">Selected role: <strong className="text-slate-800">{selectedRole.name}</strong></p>
              {selectedRole.name === "SUPER_ADMIN" ? (
                <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">SUPER_ADMIN permissions are protected and cannot be changed here.</p>
              ) : (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <select value={selectedPermissionId} onChange={(event) => setSelectedPermissionId(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-3 text-sm">
                    <option value="">Select a permission</option>
                    {permissions.filter((permission) => !assignedPermissions.some((item) => item.id === permission.id)).map((permission) => (
                      <option key={permission.id} value={permission.id}>{permission.key}</option>
                    ))}
                  </select>
                  <button onClick={() => void addPermission()} disabled={!selectedPermissionId} className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Add Permission</button>
                </div>
              )}
              <div className="mt-5 space-y-2">
                <h3 className="text-sm font-semibold text-slate-700">Assigned Permissions ({assignedPermissions.length})</h3>
                {assignedPermissions.map((permission) => (
                  <div key={permission.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3">
                    <div className="min-w-0">
                      <p className="break-all text-sm font-medium text-slate-800">{permission.key}</p>
                      {permission.description && <p className="mt-1 text-xs text-slate-500">{permission.description}</p>}
                    </div>
                    {selectedRole.name !== "SUPER_ADMIN" && (
                      <button onClick={() => void removePermission(permission.id)} className="shrink-0 text-xs font-semibold text-red-600">Remove</button>
                    )}
                  </div>
                ))}
                {!assignedPermissions.length && <p className="text-sm text-slate-500">No permissions assigned.</p>}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
