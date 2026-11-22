"use client";

import { useCallback, useEffect, useState } from "react";

type Metric = {
  label: string;
  value: number | string;
};

type DataRecord = Record<string, unknown>;

const analyticsEndpoints = [
  { key: "subjects", label: "Questions by Subject", path: "questions/by-subject" },
  { key: "topics", label: "Questions by Topic", path: "questions/by-topic" },
  { key: "exams", label: "Questions by Exam", path: "questions/by-exam" },
  { key: "reviews", label: "Reviews", path: "reviews" },
  { key: "duplicates", label: "Duplicates", path: "duplicates" },
  { key: "imports", label: "Imports", path: "imports" },
  { key: "quality", label: "Question Quality", path: "question-quality" },
];

function isRecord(value: unknown): value is DataRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getData(payload: unknown): unknown {
  if (isRecord(payload) && "data" in payload) {
    return payload.data;
  }

  return payload ?? {};
}

function getMetrics(value: unknown, prefix = ""): Metric[] {
  if (!isRecord(value)) return [];

  return Object.entries(value)
    .filter(([, item]) =>
      item === null ||
      ["string", "number", "boolean"].includes(typeof item),
    )
    .map(([key, item]) => ({
      label: `${prefix}${key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ")}`,
      value: item === null ? "—" : String(item),
    }));
}

function getRows(value: unknown): DataRecord[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (!isRecord(value)) return [];

  for (const key of ["data", "items", "results"]) {
    const candidate = value[key];

    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord);
    }
  }

  return [];
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getOverviewValue(
  overview: unknown,
  key: string,
  nestedKey?: string,
): number | string {
  if (!isRecord(overview)) return 0;

  const value = overview[key];

  if (nestedKey) {
    if (!isRecord(value)) return 0;
    const nestedValue = value[nestedKey];
    return typeof nestedValue === "number" || typeof nestedValue === "string"
      ? nestedValue
      : 0;
  }

  return typeof value === "number" || typeof value === "string" ? value : 0;
}

export default function AdminAnalyticsPage() {
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState<unknown>(null);
  const [reports, setReports] = useState<Record<string, unknown>>({});

  useEffect(() => {
    let active = true;

    async function verify() {
      try {
        const response = await fetch("/api/users/me", { cache: "no-store" });

        if (!response.ok) {
          if (active) setAccess("denied");
          return;
        }

        const payload: unknown = await response.json();
        const user = isRecord(payload)
          ? payload.data ?? payload.user ?? payload
          : null;

        const account = isRecord(user) ? user : {};
        const roles = Array.isArray(account.roles) ? account.roles : [];

        const allowed = roles.some((role: unknown) =>
          typeof role === "string"
            ? role === "SUPER_ADMIN"
            : isRecord(role) && role.name === "SUPER_ADMIN",
        );

        if (active) setAccess(allowed ? "allowed" : "denied");
      } catch {
        if (active) setAccess("denied");
      }
    }

    void verify();

    return () => {
      active = false;
    };
  }, []);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const results = await Promise.allSettled([
        fetch("/api/admin/analytics/overview", { cache: "no-store" }),
        ...analyticsEndpoints.map((endpoint) =>
          fetch(`/api/admin/analytics/${endpoint.path}`, { cache: "no-store" }),
        ),
      ]);

      const overviewResult = results[0];

      if (overviewResult.status !== "fulfilled" || !overviewResult.value.ok) {
        throw new Error("Analytics overview load করা যায়নি।");
      }

      const overviewPayload: unknown = await overviewResult.value.json();
      setOverview(getData(overviewPayload));

      const nextReports: Record<string, unknown> = {};

      for (let index = 0; index < analyticsEndpoints.length; index++) {
        const result = results[index + 1];
        const endpoint = analyticsEndpoints[index];

        if (result.status === "fulfilled" && result.value.ok) {
          nextReports[endpoint.key] = getData(await result.value.json());
        } else {
          nextReports[endpoint.key] = null;
        }
      }

      setReports(nextReports);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analytics load করা যায়নি।");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (access === "allowed") {
      void Promise.resolve().then(() => loadAnalytics());
    }
  }, [access, loadAnalytics]);

  if (access === "checking") {
    return <PanelMessage text="Permission যাচাই করা হচ্ছে..." />;
  }

  if (access === "denied") {
    return <PanelMessage text="এই পেজ ব্যবহারের জন্য Super Admin permission প্রয়োজন।" />;
  }

  const overviewMetrics: Metric[] = [
    { label: "Total Questions", value: getOverviewValue(overview, "questions", "total") },
    { label: "Published Questions", value: getOverviewValue(overview, "questions", "published") },
    { label: "Draft Questions", value: getOverviewValue(overview, "questions", "draft") },
    { label: "Hidden Questions", value: getOverviewValue(overview, "questions", "hidden") },
    { label: "Deleted Questions", value: getOverviewValue(overview, "questions", "deleted") },
    { label: "Archived Questions", value: getOverviewValue(overview, "questions", "archived") },
    { label: "Subjects", value: getOverviewValue(overview, "subjects") },
    { label: "Topics", value: getOverviewValue(overview, "topics") },
    { label: "Occurrences", value: getOverviewValue(overview, "occurrences") },
    { label: "Reviews", value: getOverviewValue(overview, "reviews") },
    { label: "Duplicates", value: getOverviewValue(overview, "duplicates") },
    { label: "Import Batches", value: getOverviewValue(overview, "importBatches") },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
          Platform Insights
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Analytics</h1>
            <p className="mt-2 text-sm text-slate-500">
              Shikhasetu platform-এর বর্তমান analytics ও content statistics।
            </p>
          </div>
          <button
            type="button"
            onClick={loadAnalytics}
            disabled={loading}
            className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh Analytics"}
          </button>
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Platform Overview</h2>
          <span className="text-xs text-slate-500">Live API data</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {overviewMetrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{metric.label}</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-bold text-slate-900">Detailed Reports</h2>

        {analyticsEndpoints.map((endpoint) => {
          const report = reports[endpoint.key];
          const rows = getRows(report);
          const metrics = getMetrics(report);
          const columns = rows.length > 0 ? Object.keys(rows[0]).slice(0, 6) : [];

          return (
            <div key={endpoint.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="font-semibold text-slate-900">{endpoint.label}</h3>
              </div>

              {report === null || report === undefined ? (
                <p className="p-5 text-sm text-slate-400">
                  এই report endpoint থেকে data পাওয়া যায়নি।
                </p>
              ) : rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        {columns.map((key) => (
                          <th key={key} className="px-5 py-3">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.slice(0, 20).map((row, index) => (
                        <tr key={displayValue(row.id ?? index)}>
                          {columns.map((key) => (
                            <td key={key} className="max-w-64 truncate px-5 py-3 text-slate-700">
                              {displayValue(row[key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : metrics.length > 0 ? (
                <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                  {metrics.map((metric) => (
                    <div key={metric.label} className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs capitalize text-slate-500">{metric.label}</p>
                      <p className="mt-1 break-words text-lg font-semibold text-slate-900">
                        {metric.value}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-5 text-sm text-slate-400">এই report-এ বর্তমানে কোনো data নেই।</p>
              )}
            </div>
          );
        })}
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
