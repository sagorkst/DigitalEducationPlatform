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

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-slate-900 p-6 text-white shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-emerald-300">
          SUPER ADMIN CONTROL PANEL
        </p>
        <h1 className="mt-3 text-2xl font-bold sm:text-3xl">
          Platform Dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          Shikhasetu platform-এর administration ও Question Bank-এর সামগ্রিক
          অবস্থা এখান থেকে পর্যবেক্ষণ করো।
        </p>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {error}
        </div>
      )}

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Question Bank Overview
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Backend analytics API থেকে পাওয়া বর্তমান তথ্য।
            </p>
          </div>
          {loadingOverview && (
            <span className="text-xs text-slate-500">Loading analytics...</span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Total Questions"
            value={questions?.total}
            description="Active Question Bank records"
          />
          <StatCard
            label="Published Questions"
            value={questions?.published}
            description="Published question records"
          />
          <StatCard
            label="Draft Questions"
            value={questions?.draft}
            description="Questions awaiting publication"
          />
          <StatCard
            label="Subjects"
            value={overview?.subjects}
            description="Registered subjects"
          />
          <StatCard
            label="Topics"
            value={overview?.topics}
            description="Registered topics"
          />
          <StatCard
            label="Exam Occurrences"
            value={overview?.occurrences}
            description="Question occurrence records"
          />
          <StatCard
            label="Reviews"
            value={overview?.reviews}
            description="Question review records"
          />
          <StatCard
            label="Duplicate Candidates"
            value={overview?.duplicates}
            description="Duplicate detection records"
          />
          <StatCard
            label="Import Batches"
            value={overview?.importBatches}
            description="Question import batches"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">
          Administration modules
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          পরবর্তী ধাপে User Management, Role Management, Permission
          Management, Role Assignment এবং Audit Logs-এর কার্যকর interface
          তৈরি করা হবে।
        </p>
      </section>
    </div>
  );
}
