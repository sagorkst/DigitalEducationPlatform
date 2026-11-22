"use client";

import { useCallback, useEffect, useState } from "react";

type Permission = {
  id: string;
  key: string;
  description?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrap(value: unknown): unknown {
  let result = value;
  for (let i = 0; i < 4 && isRecord(result) && result.data !== undefined; i++) {
    result = result.data;
  }
  return result;
}

function getError(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  if (typeof payload.message === "string") return payload.message;
  if (Array.isArray(payload.message)) return payload.message.join(", ");
  return fallback;
}

export default function AdminPermissionsPage() {
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
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

  const loadPermissions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await request("/api/admin/rbac/permissions");
      const rows: Permission[] = Array.isArray(result) ? result as Permission[] : isRecord(result) && Array.isArray(result.permissions) ? result.permissions as Permission[] : [];
      setPermissions(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load permissions.");
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
        const roles = Array.isArray(user?.roles) ? user.roles : [];
        const isSuperAdmin = roles.some((role: unknown) => (typeof role === "string" ? role : isRecord(role) ? role.name : undefined) === "SUPER_ADMIN");
        if (active) {
          setAllowed(isSuperAdmin);
          setChecking(false);
          if (isSuperAdmin) void loadPermissions();
        }
      })
      .catch(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [loadPermissions]);

  async function createPermission(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      await request("/api/admin/rbac/permissions", {
        method: "POST",
        body: JSON.stringify({ key: key.trim(), description: description.trim() || undefined }),
      });
      setKey("");
      setDescription("");
      setNotice("Permission created successfully.");
      await loadPermissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Permission creation failed.");
    }
  }

  if (checking) return <div className="rounded-2xl bg-white p-8">Checking access...</div>;
  if (!allowed) return <div className="rounded-2xl border border-red-200 bg-white p-8 text-red-700">Access denied. SUPER_ADMIN only.</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-emerald-700">ACCESS CONTROL</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Permission Management</h1>
        <p className="mt-2 text-sm text-slate-500">Create and review system permissions. Permissions are assigned to roles from Role Management.</p>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Create Permission</h2>
        <p className="mt-1 text-xs text-slate-500">Example: content.questions.manage</p>
        <form onSubmit={createPermission} className="mt-4 grid gap-3 md:grid-cols-3">
          <input value={key} onChange={(event) => setKey(event.target.value)} required minLength={3} maxLength={120} pattern="[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+" title="Use lowercase dot-separated keys, e.g. content.questions.manage" placeholder="permission.key" className="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
          <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="Description (optional)" className="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
          <button disabled={loading} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">Create Permission</button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Available Permissions ({permissions.length})</h2>
          <button onClick={() => void loadPermissions()} className="text-sm font-medium text-emerald-700">Refresh</button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr><th className="px-3 py-3">Permission Key</th><th className="px-3 py-3">Description</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {permissions.map((permission) => (
                <tr key={permission.id}>
                  <td className="break-all px-3 py-3 font-medium text-slate-800">{permission.key}</td>
                  <td className="px-3 py-3 text-slate-500">{permission.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!permissions.length && <p className="py-6 text-center text-sm text-slate-500">No permissions found.</p>}
        </div>
      </section>
    </div>
  );
}
