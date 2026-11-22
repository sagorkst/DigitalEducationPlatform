"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Institution = {
  id: string;
  name: string;
  slug?: string;
  type?: string | null;
  description?: string | null;
  website?: string | null;
  isActive: boolean;
  _count?: {
    exams?: number;
    occurrences?: number;
  };
};

type FormState = {
  name: string;
  type: string;
  description: string;
  website: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  name: "",
  type: "",
  description: "",
  website: "",
  isActive: true,
};

function unwrap(payload: unknown): unknown { if (typeof payload === "object" && payload !== null && "data" in payload) return payload.data; return payload; }

function getMessage(payload: unknown, fallback: string) { const message = typeof payload === "object" && payload !== null && "message" in payload ? payload.message : undefined; if (Array.isArray(message)) return message.join(", "); return typeof message === "string" ? message : fallback; }

export default function AdminInstitutionsPage() {
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function verifyAccess() {
      try {
        const response = await fetch("/api/users/me", { cache: "no-store" });
        if (!response.ok) {
          if (active) setAccess("denied");
          return;
        }

        const payload = await response.json();
        const user = payload?.data?.user ?? payload?.data ?? payload?.user ?? payload;
        const roles = Array.isArray(user?.roles) ? user.roles : [];

        const allowed = roles.some((role: unknown) => typeof role === "string" ? role === "SUPER_ADMIN" : typeof role === "object" && role !== null && "name" in role && role.name === "SUPER_ADMIN");

        if (active) setAccess(allowed ? "allowed" : "denied");
      } catch {
        if (active) setAccess("denied");
      }
    }

    verifyAccess();
    return () => {
      active = false;
    };
  }, []);

  const loadInstitutions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });

      if (search) params.set("search", search);
      if (typeFilter) params.set("type", typeFilter);
      if (activeFilter) params.set("isActive", activeFilter);

      const response = await fetch(`/api/admin/institutions?${params.toString()}`, {
        cache: "no-store",
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getMessage(payload, `Request failed (${response.status}).`));
      }

      const data = unwrap(payload);
      setInstitutions(Array.isArray(data) ? data : []);
      setTotal(Number(payload?.pagination?.total ?? 0));
      setTotalPages(Math.max(1, Number(payload?.pagination?.totalPages ?? 1)));
    } catch (err) {
      setInstitutions([]);
      setError(err instanceof Error ? err.message : "Institutions load করা যায়নি।");
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, activeFilter]);

  useEffect(() => { if (access === "allowed") { void Promise.resolve().then(() => loadInstitutions()); } }, [access, loadInstitutions]);

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  function startEdit(item: Institution) {
    setEditingId(item.id);
    setForm({
      name: item.name || "",
      type: item.type || "",
      description: item.description || "",
      website: item.website || "",
      isActive: item.isActive,
    });
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  async function saveInstitution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const body = {
        name: form.name.trim(),
        type: form.type.trim() || undefined,
        description: form.description.trim() || undefined,
        website: form.website.trim() || undefined,
        isActive: form.isActive,
      };

      const endpoint = editingId
        ? `/api/admin/institutions/${encodeURIComponent(editingId)}`
        : "/api/admin/institutions";

      const response = await fetch(endpoint, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getMessage(payload, `Save failed (${response.status}).`),
        );
      }

      setFormOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      setNotice(editingId ? "Institution updated successfully." : "Institution created successfully.");
      await loadInstitutions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Institution save করা যায়নি।");
    } finally {
      setSaving(false);
    }
  }

  async function deleteInstitution(item: Institution) {
    if (
      !window.confirm(
        `Delete "${item.name}"? If it has linked exams or occurrences, the API will reject deletion.`,
      )
    ) {
      return;
    }

    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/admin/institutions/${encodeURIComponent(item.id)}`,
        { method: "DELETE" },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getMessage(payload, `Delete failed (${response.status}).`),
        );
      }

      setNotice("Institution deleted successfully.");
      await loadInstitutions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Institution delete করা যায়নি।");
    }
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
          Content Administration
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Institutions Management
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Institution তৈরি, তথ্য পরিবর্তন, search এবং status পরিচালনা করো।
            </p>
          </div>
          <button
            type="button"
            onClick={startCreate}
            className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            + Add Institution
          </button>
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

      {formOpen && (
        <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold text-slate-900">
              {editingId ? "Edit Institution" : "Create Institution"}
            </h2>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
            >
              Close
            </button>
          </div>

          <form onSubmit={saveInstitution} className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Institution Name *
              <input
                required
                minLength={2}
                maxLength={150}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal"
                placeholder="e.g. Bangladesh Public Service Commission"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Institution Type
              <input
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal"
                placeholder="Institution type"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Website
              <input
                type="url"
                value={form.website}
                onChange={(event) => setForm({ ...form, website: event.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal"
                placeholder="https://example.com"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Status
              <select
                value={form.isActive ? "true" : "false"}
                onChange={(event) => setForm({ ...form, isActive: event.target.value === "true" })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700 md:col-span-2">
              Description
              <textarea
                rows={3}
                maxLength={1000}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal"
                placeholder="Institution description"
              />
            </label>

            <div className="flex flex-wrap gap-2 md:col-span-2">
              <button
                disabled={saving}
                className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : editingId ? "Save Changes" : "Create Institution"}
              </button>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-slate-900">Institution Directory</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500">Total: {total}</span>
          </div>
        </div>

        <form onSubmit={applySearch} className="mt-4 grid gap-3 md:grid-cols-4">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search name, slug or description"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm md:col-span-2"
          />

          <input
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value);
              setPage(1);
            }}
            placeholder="Filter by type"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />

          <select
            value={activeFilter}
            onChange={(event) => {
              setActiveFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          >
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>

          <button className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 md:col-span-4">
            Search Institutions
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading institutions...</p>
        ) : institutions.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            কোনো institution পাওয়া যায়নি।
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {institutions.map((item) => (
              <article key={item.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900">{item.name}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        item.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {item.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      {item.type || "No type specified"}
                    </p>

                    {item.description && (
                      <p className="mt-2 max-w-3xl text-sm text-slate-600">
                        {item.description}
                      </p>
                    )}

                    {item.website && (
                      <a
                        href={item.website}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-sm text-emerald-700 underline"
                      >
                        {item.website}
                      </a>
                    )}

                    <p className="mt-3 text-xs text-slate-400">
                      Exams: {item._count?.exams ?? 0} · Occurrences: {item._count?.occurrences ?? 0}
                    </p>
                    {item.slug && (
                      <p className="mt-1 text-xs text-slate-400">Slug: {item.slug}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteInstitution(item)}
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
          <span className="text-xs text-slate-500">
            Page {page} of {totalPages}
          </span>
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

