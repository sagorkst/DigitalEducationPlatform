"use client";

import { useCallback, useEffect, useState } from "react";

type Role = {
  id: string;
  name: string;
};

type User = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string;
  roles?: Array<string | { name?: string; id?: string }>;
  userRoles?: Array<{ role?: Role }>;
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

function getUserRoles(user: User): Array<{ id?: string; name: string }> {
  if (Array.isArray(user.roles)) {
    return user.roles.map((role) =>
      typeof role === "string" ? { name: role } : { id: role.id, name: role.name || "" }
    );
  }
  if (Array.isArray(user.userRoles)) {
    return user.userRoles.map((item) => ({
      id: item.role?.id,
      name: item.role?.name || "",
    }));
  }
  return [];
}

export default function AdminRoleAssignmentsPage() {
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const request = useCallback(async (url: string, options?: RequestInit) => {
    const response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(getError(payload, "Request failed."));
    return unwrap(payload);
  }, []);

  const loadRoles = useCallback(async () => {
    const result = await request("/api/admin/rbac/roles");
    const rows = Array.isArray(result) ? result : Array.isArray(result?.roles) ? result.roles : [];
    setRoles(rows.filter((role: Role) => role.name !== "SUPER_ADMIN"));
    setSelectedRoleId((current) =>
      rows.some((role: Role) => role.id === current && role.name !== "SUPER_ADMIN")
        ? current
        : rows.find((role: Role) => role.name !== "SUPER_ADMIN")?.id || ""
    );
  }, [request]);

  const loadUsers = useCallback(async (query: string, pageNumber = 1) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(pageNumber), limit: "30" });
      if (query.trim()) params.set("search", query.trim());
      const response = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getError(payload, "Could not load users."));
      const result = unwrap(payload);
      const rows = Array.isArray(result)
        ? result
        : Array.isArray(result?.users) ? result.users : [];
      const pagination = payload?.pagination ?? payload?.data?.pagination ?? result?.pagination;
      setUsers(rows);
      setPage(Number(pagination?.page ?? pageNumber) || pageNumber);
      setTotalPages(Math.max(1, Number(pagination?.totalPages ?? 1) || 1));
      setTotalUsers(Number(pagination?.total ?? rows.length) || 0);
      setSelectedUserId((current) =>
        rows.some((user: User) => user.id === current) ? current : rows[0]?.id || ""
      );
    } catch (err) {
      setUsers([]);
      setError(err instanceof Error ? err.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/users/me", { cache: "no-store" })
      .then((response) => response.json())
      .then(async (payload) => {
        const user = payload?.data ?? payload;
        const userRoles = Array.isArray(user?.roles) ? user.roles : [];
        const isSuperAdmin = userRoles.some((role: any) =>
          (typeof role === "string" ? role : role?.name) === "SUPER_ADMIN"
        );
        if (active) {
          setAllowed(isSuperAdmin);
          setChecking(false);
        }
        if (active && isSuperAdmin) {
          await Promise.all([loadRoles(), loadUsers("")]);
        }
      })
      .catch(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [loadRoles, loadUsers]);

  async function assignRole() {
    if (!selectedUserId || !selectedRoleId) return;
    setError("");
    setNotice("");
    try {
      await request(`/api/admin/rbac/users/${selectedUserId}/roles`, {
        method: "POST",
        body: JSON.stringify({ roleId: selectedRoleId }),
      });
      setNotice("Role assigned successfully.");
      await loadUsers(search, page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role assignment failed.");
    }
  }

  async function removeRole(userId: string, roleId: string, roleName: string) {
    if (roleName === "SUPER_ADMIN") return;
    if (!window.confirm(`Remove role "${roleName}" from this user?`)) return;
    setError("");
    setNotice("");
    try {
      await request(`/api/admin/rbac/users/${userId}/roles/${roleId}`, { method: "DELETE" });
      setNotice("Role removed successfully.");
      await loadUsers(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role removal failed.");
    }
  }

  const selectedUser = users.find((user) => user.id === selectedUserId);

  if (checking) return <div className="rounded-2xl bg-white p-8">Checking access...</div>;
  if (!allowed) return <div className="rounded-2xl border border-red-200 bg-white p-8 text-red-700">Access denied. SUPER_ADMIN only.</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-emerald-700">ACCESS CONTROL</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Role Assignment</h1>
        <p className="mt-2 text-sm text-slate-500">Assign or remove system roles for registered users. SUPER_ADMIN cannot be assigned here.</p>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Find User</h2>
        <form onSubmit={(event) => { event.preventDefault(); void loadUsers(search, 1); }} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, email or phone" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm" />
          <button disabled={loading} className="rounded-xl bg-slate-800 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Search Users</button>
        </form>
        <p className="mt-2 text-xs text-slate-500">Page {page} of {totalPages} · {totalUsers.toLocaleString("en-US")} matching users</p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Users ({totalUsers.toLocaleString("en-US")})</h2>
          <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto">
            {users.map((user) => (
              <button key={user.id} onClick={() => setSelectedUserId(user.id)} className={`w-full rounded-xl border p-3 text-left ${selectedUserId === user.id ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:bg-slate-50"}`}>
                <span className="block text-sm font-semibold text-slate-900">{user.name || "Unnamed user"}</span>
                <span className="mt-1 block break-all text-xs text-slate-500">{user.email || user.phone || user.id}</span>
                <span className="mt-1 block text-xs text-slate-400">{user.status || "—"}</span>
              </button>
            ))}
            {!users.length && <p className="text-sm text-slate-500">No users found.</p>}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <button type="button" onClick={() => void loadUsers(search, Math.max(1, page - 1))} disabled={loading || page <= 1} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-40">Previous</button>
            <span className="text-xs text-slate-500">Page {page} / {totalPages}</span>
            <button type="button" onClick={() => void loadUsers(search, Math.min(totalPages, page + 1))} disabled={loading || page >= totalPages} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-40">Next</button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Assign / Remove Roles</h2>
          {!selectedUser ? (
            <p className="mt-4 text-sm text-slate-500">Select a user from the list.</p>
          ) : (
            <>
              <div className="mt-3 rounded-xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">{selectedUser.name || "Unnamed user"}</p>
                <p className="mt-1 break-all text-sm text-slate-500">{selectedUser.email || "No email"}</p>
                <p className="mt-1 text-xs text-slate-500">Status: {selectedUser.status || "—"}</p>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <select value={selectedRoleId} onChange={(event) => setSelectedRoleId(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-3 text-sm">
                  <option value="">Select role</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
                <button onClick={() => void assignRole()} disabled={!selectedRoleId || selectedUser.status !== "ACTIVE"} className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Assign Role</button>
              </div>
              {selectedUser.status !== "ACTIVE" && <p className="mt-2 text-xs text-amber-700">Only ACTIVE users can receive roles.</p>}

              <div className="mt-6 space-y-2">
                <h3 className="text-sm font-semibold text-slate-700">Current Roles</h3>
                {getUserRoles(selectedUser).map((role, index) => {
                  const matchedRole = roles.find((item) => item.name === role.name);
                  const roleId = role.id || matchedRole?.id;
                  return (
                    <div key={`${role.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-3">
                      <span className="break-all text-sm font-medium text-slate-800">{role.name}</span>
                      {role.name !== "SUPER_ADMIN" && roleId && (
                        <button onClick={() => void removeRole(selectedUser.id, roleId, role.name)} className="shrink-0 text-xs font-semibold text-red-600">Remove</button>
                      )}
                    </div>
                  );
                })}
                {!getUserRoles(selectedUser).length && <p className="text-sm text-slate-500">No roles returned for this user.</p>}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
