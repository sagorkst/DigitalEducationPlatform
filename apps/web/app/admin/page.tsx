"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AccessState = "checking" | "allowed" | "denied";

type OverviewData = {
  questions?: {
    total?: number;
    deleted?: number;
    draft?: number;
    published?: number;
    hidden?: number;
    archived?: number;
  };
  subjects?: number;
  topics?: number;
  occurrences?: number;
  reviews?: number;
  duplicates?: number;
  importBatches?: number;
};

function formatNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number.toLocaleString("en-US") : "0";
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: unknown;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
        {formatNumber(value)}
      </p>
      <p className="mt-2 text-xs text-slate-500">{description}</p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [access, setAccess] = useState<AccessState>("checking");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const profileResponse = await fetch("/api/users/me", {
          cache: "no-store",
        });

        if (!profileResponse.ok) {
          if (active) {
            setAccess("denied");
            setError(
              profileResponse.status === 401
                ? "এই পেজ দেখতে লগইন করতে হবে।"
                : "আপনার অ্যাকাউন্টের তথ্য যাচাই করা যায়নি।",
            );
          }
          return;
        }

        const profilePayload = await profileResponse.json();
        const profile =
          profilePayload?.data?.user ??
          profilePayload?.data ??
          profilePayload?.user ??
          profilePayload;

        const roles = Array.isArray(profile?.roles)
          ? profile.roles
          : Array.isArray(profile?.userRoles)
            ? profile.userRoles.map(
                (item: { role?: { name?: string } }) => item?.role,
              )
            : [];

        const isSuperAdmin = roles.some(
          (role: string | { name?: string }) =>
            typeof role === "string"
              ? role === "SUPER_ADMIN"
              : role?.name === "SUPER_ADMIN",
        );

        if (!isSuperAdmin) {
          if (active) {
            setAccess("denied");
            setError("এই Control Panel ব্যবহারের অনুমতি আপনার নেই।");
          }
          return;
        }

        if (!active) return;

        setAccess("allowed");
        setLoadingOverview(true);

        const overviewResponse = await fetch(
          "/api/admin/analytics/overview",
          { cache: "no-store" },
        );

        const overviewPayload = await overviewResponse.json().catch(() => null);

        if (!overviewResponse.ok) {
          throw new Error(
            overviewPayload?.message ??
              "Dashboard analytics load করা যায়নি।",
          );
        }

        if (active) {
          setOverview(overviewPayload?.data ?? null);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Dashboard load করতে সমস্যা হয়েছে।",
          );
        }
      } finally {
        if (active) {
          setLoadingOverview(false);
        }
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  if (access === "checking") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-slate-600">
          Account permission যাচাই করা হচ্ছে...
        </p>
      </div>
    );
  }

  if (access === "denied") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-3xl">🔒</div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">
          Access restricted
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {error || "এই পেজ ব্যবহারের অনুমতি নেই।"}
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
        >
          Login
        </Link>
      </div>
    );
  }

  const questions = overview?.questions;

  const modules = [
    { href: "/admin/questions", title: "Question Bank", description: "Questions, answers, explanations, history and imports", icon: "📚", tag: "CONTENT" },
    { href: "/admin/exams", title: "Exams & Posts", description: "Exam records, years, grades and post mapping", icon: "📝", tag: "ACADEMIC" },
    { href: "/admin/institutions", title: "Institutions", description: "Institution directory and linked records", icon: "🏢", tag: "ACADEMIC" },
    { href: "/admin/users", title: "User Management", description: "Accounts, verification and account status", icon: "👥", tag: "ACCESS" },
    { href: "/admin/roles", title: "Roles", description: "System roles and role permissions", icon: "🛡️", tag: "ACCESS" },
    { href: "/admin/permissions", title: "Permissions", description: "Permission catalogue and access rules", icon: "🔐", tag: "ACCESS" },
    { href: "/admin/role-assignments", title: "Role Assignments", description: "Manage role assignments for platform users", icon: "🧩", tag: "ACCESS" },
    { href: "/admin/audit-logs", title: "Audit Trail", description: "Review recorded administrative activity", icon: "📋", tag: "SECURITY" },
    { href: "/admin/analytics", title: "Analytics & Reports", description: "Platform statistics and content reports", icon: "📊", tag: "INSIGHTS" },
  ];

  const stats = [
    { label: "Total questions", value: questions?.total, detail: "Question Bank records", icon: "❖", tone: "blue" },
    { label: "Published", value: questions?.published, detail: "Visible to learners", icon: "✓", tone: "green" },
    { label: "Drafts", value: questions?.draft, detail: "Awaiting publication", icon: "✎", tone: "amber" },
    { label: "Exam occurrences", value: overview?.occurrences, detail: "Question-to-exam links", icon: "▣", tone: "violet" },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl shadow-slate-900/10 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Super Admin Workspace
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Platform Dashboard
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              Shikhasetu-এর content, users, academic records এবং platform operations এক জায়গা থেকে পরিচালনা ও পর্যবেক্ষণ করো।
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/questions" className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300">
              <span>＋</span> Manage Questions
            </Link>
            <Link href="/admin/analytics" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              View Reports <span>→</span>
            </Link>
          </div>
        </div>
        <div className="relative mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-4 text-xs text-slate-400">
          <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Admin access verified</span>
          <span>Live data from platform API</span>
          {loadingOverview && <span className="text-emerald-300">Refreshing overview…</span>}
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">At a glance</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Platform Overview</h2>
            <p className="mt-1 text-sm text-slate-500">মূল content এবং exam mapping-এর বর্তমান অবস্থা।</p>
          </div>
          <Link href="/admin/analytics" className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">All analytics →</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          {stats.map((item) => (
            <div key={item.label} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">{item.label}</p>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold ${item.tone === "green" ? "bg-emerald-50 text-emerald-700" : item.tone === "amber" ? "bg-amber-50 text-amber-700" : item.tone === "violet" ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}>{item.icon}</span>
              </div>
              <p className="mt-4 text-3xl font-bold tracking-tight text-slate-950 tabular-nums">{formatNumber(item.value)}</p>
              <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Subjects" value={overview?.subjects} description="Registered subjects" />
          <StatCard label="Topics" value={overview?.topics} description="Study topics" />
          <StatCard label="Reviews" value={overview?.reviews} description="Question review records" />
          <StatCard label="Duplicates" value={overview?.duplicates} description="Duplicate candidates" />
          <StatCard label="Import batches" value={overview?.importBatches} description="Import history batches" />
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">Workspace</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Administration Modules</h2>
            <p className="mt-1 text-sm text-slate-500">প্রতিটি বিভাগে সরাসরি প্রবেশ করে সংশ্লিষ্ট তথ্য পরিচালনা করো।</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500">9 modules</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {modules.map((item) => (
            <Link key={item.href} href={item.href} className="group flex min-h-[142px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-950/5">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-2xl transition group-hover:bg-emerald-50">{item.icon}</span>
                <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[9px] font-bold tracking-[0.14em] text-slate-400">{item.tag}</span>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <h3 className="font-bold text-slate-900 group-hover:text-emerald-800">{item.title}</h3>
                <span className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-700">→</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Operations</p>
              <h2 className="mt-1 font-bold text-slate-900">Common Admin Tasks</h2>
            </div>
            <span className="text-xl">⚡</span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              { href: "/admin/questions", label: "Review & publish questions", hint: "Manage question status" },
              { href: "/admin/exams", label: "Add an exam", hint: "Maintain exam records" },
              { href: "/admin/users", label: "Manage user accounts", hint: "Review account status" },
              { href: "/admin/audit-logs", label: "Inspect admin activity", hint: "Review audit records" },
            ].map((action) => (
              <Link key={action.href + action.label} href={action.href} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 transition hover:border-emerald-200 hover:bg-emerald-50">
                <span><span className="block text-sm font-semibold text-slate-800">{action.label}</span><span className="mt-0.5 block text-xs text-slate-500">{action.hint}</span></span>
                <span className="ml-3 text-slate-400">→</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">System Snapshot</p>
          <h2 className="mt-1 font-bold text-slate-900">Content Status</h2>
          <div className="mt-4 space-y-3">
            {[
              { label: "Published", value: questions?.published, color: "bg-emerald-500" },
              { label: "Draft", value: questions?.draft, color: "bg-amber-500" },
              { label: "Hidden", value: questions?.hidden, color: "bg-slate-400" },
              { label: "Archived", value: questions?.archived, color: "bg-violet-500" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-slate-600"><span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />{item.label}</span>
                <span className="font-bold tabular-nums text-slate-900">{formatNumber(item.value)}</span>
              </div>
            ))}
          </div>
          <Link href="/admin/analytics" className="mt-5 inline-flex text-sm font-semibold text-emerald-700 hover:text-emerald-900">Explore platform analytics →</Link>
        </div>
      </section>
    </div>
  );
}
