"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Institution = {
  id: string;
  name: string;
};

type Post = {
  id: string;
  name: string;
};

type Exam = {
  id: string;
  name: string;
  slug?: string | null;
  examYear?: number | null;
  examType?: string | null;
  description?: string | null;
  institutionId?: string | null;
  postId?: string | null;
  institution?: Institution | null;
  post?: Post | null;
};

type ExamForm = {
  name: string;
  examYear: string;
  examType: string;
  institutionId: string;
  postId: string;
  slug: string;
  description: string;
};

const emptyForm: ExamForm = {
  name: "",
  examYear: "",
  examType: "",
  institutionId: "",
  postId: "",
  slug: "",
  description: "",
};

function getMessage(payload: any, fallback: string) {
  if (Array.isArray(payload?.message)) return payload.message.join(", ");
  return typeof payload?.message === "string" ? payload.message : fallback;
}

function getRows(payload: any): Exam[] {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

function getPagination(payload: any) {
  return payload?.pagination ?? payload?.data?.pagination ?? {};
}

export default function AdminExamsPage() {
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");
  const [exams, setExams] = useState<Exam[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("");
  const [postFilter, setPostFilter] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [form, setForm] = useState<ExamForm>(emptyForm);
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

        const allowed = roles.some((role: any) =>
          typeof role === "string"
            ? role === "SUPER_ADMIN"
            : role?.name === "SUPER_ADMIN",
        );

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

  const loadLookups = useCallback(async () => {
    try {
      const [institutionResponse, postResponse] = await Promise.all([
        fetch("/api/admin/institutions?limit=500", { cache: "no-store" }),
        fetch("/api/admin/posts?limit=500", { cache: "no-store" }),
      ]);

      if (institutionResponse.ok) {
        const payload = await institutionResponse.json();
        setInstitutions(getRows(payload));
      }

      if (postResponse.ok) {
        const payload = await postResponse.json();
        setPosts(getRows(payload));
      }
    } catch {
      // The main exam list remains usable if lookup data is unavailable.
    }
  }, []);

  const loadExams = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });

      if (search) params.set("search", search);
      if (yearFilter) params.set("examYear", yearFilter);
      if (typeFilter) params.set("examType", typeFilter);
      if (institutionFilter) params.set("institutionId", institutionFilter);
      if (postFilter) params.set("postId", postFilter);

      const response = await fetch(`/api/admin/exams?${params.toString()}`, {
        cache: "no-store",
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getMessage(payload, `Request failed (${response.status}).`));
      }

      setExams(getRows(payload));

      const pagination = getPagination(payload);
      setTotal(Number(pagination.total ?? 0));
      setTotalPages(Math.max(1, Number(pagination.totalPages ?? 1)));
    } catch (err) {
      setExams([]);
      setError(err instanceof Error ? err.message : "Exams load করা যায়নি।");
    } finally {
      setLoading(false);
    }
  }, [page, search, yearFilter, typeFilter, institutionFilter, postFilter]);

  useEffect(() => {
    if (access === "allowed") {
      loadLookups();
      loadExams();
    }
  }, [access, loadLookups, loadExams]);

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  function openEdit(exam: Exam) {
    setEditingId(exam.id);
    setForm({
      name: exam.name || "",
      examYear: exam.examYear ? String(exam.examYear) : "",
      examType: exam.examType || "",
      institutionId: exam.institutionId || exam.institution?.id || "",
      postId: exam.postId || exam.post?.id || "",
      slug: exam.slug || "",
      description: exam.description || "",
    });
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  async function saveExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const examYear = form.examYear.trim()
        ? Number(form.examYear)
        : undefined;

      if (
        examYear !== undefined &&
        (!Number.isInteger(examYear) || examYear < 1900 || examYear > 2100)
      ) {
        throw new Error("Exam year 1900 থেকে 2100-এর মধ্যে হতে হবে।");
      }

      const body = {
        name: form.name.trim(),
        examYear,
        examType: form.examType.trim() || undefined,
        institutionId: form.institutionId || undefined,
        postId: form.postId || undefined,
        slug: form.slug.trim() || undefined,
        description: form.description.trim() || undefined,
      };

      const endpoint = editingId
        ? `/api/admin/exams/${encodeURIComponent(editingId)}`
        : "/api/admin/exams";

      const response = await fetch(endpoint, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getMessage(payload, `Save failed (${response.status}).`));
      }

      setFormOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      setNotice(editingId ? "Exam updated successfully." : "Exam created successfully.");
      await loadExams();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Exam save করা যায়নি।");
    } finally {
      setSaving(false);
    }
  }

  async function deleteExam(exam: Exam) {
    if (!window.confirm(`Delete exam "${exam.name}" (${exam.examYear ?? "Year not set"})?`)) {
      return;
    }

    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/admin/exams/${encodeURIComponent(exam.id)}`,
        { method: "DELETE" },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getMessage(payload, `Delete failed (${response.status}).`));
      }

      setNotice("Exam deleted successfully.");
      await loadExams();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Exam delete করা যায়নি।");
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
          Examination Administration
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Exams Management</h1>
            <p className="mt-2 text-sm text-slate-500">
              Institution, post, year ও exam stage অনুযায়ী আলাদা exam record পরিচালনা করো।
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            + Add Exam
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
              {editingId ? "Edit Exam" : "Create Exam"}
            </h2>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
            >
              Close
            </button>
          </div>

          <form onSubmit={saveExam} className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700 md:col-span-2">
              Exam Name *
              <input
                required
                minLength={1}
                maxLength={200}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="e.g. BCS Preliminary Examination"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Exam Year
              <input
                type="number"
                min={1900}
                max={2100}
                step={1}
                value={form.examYear}
                onChange={(event) => setForm({ ...form, examYear: event.target.value })}
                placeholder="e.g. 2026"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Exam Type / Stage
              <input
                maxLength={100}
                value={form.examType}
                onChange={(event) => setForm({ ...form, examType: event.target.value })}
                placeholder="Preliminary / Written / Viva"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Institution
              <select
                value={form.institutionId}
                onChange={(event) => setForm({ ...form, institutionId: event.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal"
              >
                <option value="">No institution selected</option>
                {institutions.map((institution) => (
                  <option key={institution.id} value={institution.id}>
                    {institution.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Post
              <select
                value={form.postId}
                onChange={(event) => setForm({ ...form, postId: event.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal"
              >
                <option value="">No post selected</option>
                {posts.map((post) => (
                  <option key={post.id} value={post.id}>
                    {post.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700 md:col-span-2">
              Slug
              <input
                maxLength={100}
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: event.target.value })}
                placeholder="Optional URL slug"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal"
              />
            </label>

            <label className="text-sm font-medium text-slate-700 md:col-span-2">
              Description
              <textarea
                rows={3}
                maxLength={5000}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Exam description"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal"
              />
            </label>

            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 md:col-span-2">
              আলাদা exam stage/type অথবা আলাদা year হলে নতুন Exam record তৈরি করবে।
              যেমন: একই BCS-এর Preliminary 2025 এবং Written 2025 দুটি পৃথক record।
            </div>

            <div className="flex flex-wrap gap-2 md:col-span-2">
              <button
                disabled={saving}
                className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : editingId ? "Save Changes" : "Create Exam"}
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
          <h2 className="font-bold text-slate-900">Exam Directory</h2>
          <span className="text-sm text-slate-500">Total: {total}</span>
        </div>

        <form onSubmit={applySearch} className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search exam name"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />
          <input
            type="number"
            min={1900}
            max={2100}
            value={yearFilter}
            onChange={(event) => {
              setYearFilter(event.target.value);
              setPage(1);
            }}
            placeholder="Exam year"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />
          <input
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value);
              setPage(1);
            }}
            placeholder="Exam type / stage"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />

          <select
            value={institutionFilter}
            onChange={(event) => {
              setInstitutionFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          >
            <option value="">All institutions</option>
            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </select>

          <select
            value={postFilter}
            onChange={(event) => {
              setPostFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          >
            <option value="">All posts</option>
            {posts.map((post) => (
              <option key={post.id} value={post.id}>
                {post.name}
              </option>
            ))}
          </select>

          <button className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700">
            Search Exams
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading exams...</p>
        ) : exams.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">কোনো exam পাওয়া যায়নি।</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {exams.map((exam) => (
              <article key={exam.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900">{exam.name}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                        Year: {exam.examYear ?? "Not set"}
                      </span>
                      <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800">
                        {exam.examType || "Type not set"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      Institution: {exam.institution?.name || "Not assigned"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Post: {exam.post?.name || "Not assigned"}
                    </p>
                    {exam.description && (
                      <p className="mt-2 max-w-3xl text-sm text-slate-500">
                        {exam.description}
                      </p>
                    )}
                    {exam.slug && (
                      <p className="mt-2 text-xs text-slate-400">Slug: {exam.slug}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">ID: {exam.id}</p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(exam)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteExam(exam)}
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
