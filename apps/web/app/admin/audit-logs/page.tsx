"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type AuditLog = {
  id: string;
  actorId?: string | null;
  actor?: { id?: string; name?: string; email?: string } | null;
  action?: string;
  entityType?: string | null;
  entityId?: string | null;
  createdAt?: string;
  metadata?: unknown;
  [key: string]: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractRows(payload: unknown): AuditLog[] {
  if (Array.isArray(payload)) return payload as AuditLog[];
  if (!isRecord(payload)) return [];
  if (Array.isArray(payload.data)) return payload.data as AuditLog[];
  if (isRecord(payload.data) && Array.isArray(payload.data.data)) {
    return payload.data.data as AuditLog[];
  }
  return [];
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function AdminAuditLogsPage() {
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    let active = true;

    async function verify() {
      try {
        const response = await fetch("/api/users/me", { cache: "no-store" });
        if (!response.ok) {
          if (active) setAccess("denied");
          return;
        }

        const payload = await response.json();
        const user = payload?.data?.user ?? payload?.data ?? payload?.user ?? payload;
        const roles = Array.isArray(user?.roles) ? user.roles : [];
        const allowed = roles.some((role: unknown) => typeof role === "string" ? role === "SUPER_ADMIN" : isRecord(role) && role.name === "SUPER_ADMIN",)

        if (active) setAccess(allowed ? "allowed" : "denied");
      } catch {
        if (active) setAccess("denied");
      }
    }

    verify();
    return () => { active = false; };
  }, []);

  const loadLogs = useCallback(async (targetPage = page) => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: "25",
      });

      if (action.trim()) params.set("action", action.trim());
      if (entityType.trim()) params.set("entityType", entityType.trim());
      if (from) params.set("from", new Date(from).toISOString());
      if (to) params.set("to", new Date(to).toISOString());

      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        cache: "no-store",
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          typeof payload?.message === "string"
            ? payload.message
            : `Audit log request failed (${response.status})`,
        );
      }

      setLogs(extractRows(payload));

      const pagination = payload?.pagination ?? payload?.data?.pagination;
      if (pagination) {
        setTotalPages(Math.max(1, Number(pagination.totalPages) || 1));
      } else {
        setTotalPages(1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit logs load করা যায়নি।");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, action, entityType, from, to]);

  useEffect(() => { if (access === "allowed") { void Promise.resolve().then(() => loadLogs(page)); } }, [access, page, loadLogs]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    loadLogs(1);
  }

  if (access === "checking") {
    return <PanelMessage text="Permission যাচাই করা হচ্ছে..." />;
  }

  if (access === "denied") {
    return <PanelMessage text="এই পেজ ব্যবহারের জন্য Super Admin permission প্রয়োজন।" />;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
          Security Monitoring
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Audit Logs</h1>
        <p className="mt-2 text-sm text-slate-500">
          Platform-এর recorded administrative ও security activities দেখো।
        </p>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-slate-900">Filter Audit Events</h2>
        <form onSubmit={applyFilters} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            value={action}
            onChange={(event) => setAction(event.target.value)}
            placeholder="Action"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />
          <input
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
            placeholder="Entity type"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />
          <label className="text-xs text-slate-500">
            From
            <input
              type="datetime-local"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm text-slate-800"
            />
          </label>
          <label className="text-xs text-slate-500">
            To
            <input
              type="datetime-local"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm text-slate-800"
            />
          </label>
          <button className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 sm:col-span-2 lg:col-span-4">
            Apply Filters
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <h2 className="font-bold text-slate-900">Activity History</h2>
          <button
            type="button"
            onClick={() => loadLogs(page)}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading audit logs...</p>
        ) : logs.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">কোনো audit log পাওয়া যায়নি।</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">Actor</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Entity</th>
                  <th className="px-5 py-3">Entity ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log, index) => (
                  <tr key={log.id || index} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-800">
                        {log.actor?.name || log.actor?.email || "System / Unknown"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {log.actorId || log.actor?.id || ""}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800">
                        {log.action || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-700">{log.entityType || "—"}</td>
                    <td className="max-w-48 truncate px-5 py-4 font-mono text-xs text-slate-500">
                      {log.entityId || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
          <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function PanelMessage({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
      {text}
    </div>
  );
}
