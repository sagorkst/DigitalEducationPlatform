"use client";

import { useEffect, useState } from "react";

function hasQuestionManagementAccess(payload: any): boolean {
  const candidates = [
    payload?.data,
    payload?.data?.user,
    payload?.data?.account,
    payload?.user,
    payload?.account,
  ].filter(Boolean);

  for (const item of candidates) {
    const roles = [
      item.role,
      ...(Array.isArray(item.roles) ? item.roles : []),
    ]
      .map((role: any) =>
        typeof role === "string"
          ? role
          : role?.name ?? role?.code ?? role?.role,
      )
      .filter(Boolean);

    const permissions = Array.isArray(item.permissions)
      ? item.permissions
          .map((permission: any) =>
            typeof permission === "string"
              ? permission
              : permission?.name ?? permission?.code,
          )
          .filter(Boolean)
      : [];

    if (
      roles.includes("SUPER_ADMIN") ||
      roles.includes("ADMIN") ||
      permissions.includes("content.manage")
    ) {
      return true;
    }
  }

  return false;
}

const links = [
  { label: "হোম", href: "/" },
  { label: "একাডেমিক", href: "/academic" },
  { label: "চাকরি প্রস্তুতি", href: "/career" },
  { label: "ভর্তি", href: "/admission" },
  { label: "দক্ষতা উন্নয়ন", href: "/skills" },
  { label: "কোর্স", href: "/courses" },
  { label: "প্রশ্নব্যাংক", href: "/question-bank" },
  { label: "পরীক্ষা", href: "/exams" },
  { label: "লাইব্রেরি", href: "/library" },
];

export default function SiteHeader() {
  const [canManageQuestions, setCanManageQuestions] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });

        if (!response.ok) {
          if (active) setCanManageQuestions(false);
          return;
        }

        const payload = await response.json();

        if (active) {
          setCanManageQuestions(hasQuestionManagementAccess(payload));
        }
      } catch {
        if (active) setCanManageQuestions(false);
      }
    }

    checkAccess();

    return () => {
      active = false;
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4">
        <a href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-xl text-white">
            🎓
          </span>
          <span className="text-xl font-black tracking-tight text-slate-900">
            শিক্ষাসেতু
          </span>
        </a>

        <nav className="hidden items-center gap-5 xl:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="whitespace-nowrap text-sm font-semibold text-slate-600 transition hover:text-blue-700"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-3 lg:flex">
          {canManageQuestions && (
            <a
              href="/dashboard/question-bank"
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800"
            >
              প্রশ্নব্যাংক পরিচালনা
            </a>
          )}

          <a
            href="/login"
            className="rounded-xl px-4 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
          >
            লগইন
          </a>

          <a
            href="/register"
            className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800"
          >
            নিবন্ধন করুন
          </a>
        </div>

        <details className="relative lg:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">
            <span>মেনু</span>
            <span className="text-lg">☰</span>
          </summary>

          <nav className="absolute right-0 top-14 z-50 max-h-[75vh] w-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="block rounded-lg px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
              >
                {link.label}
              </a>
            ))}

            {canManageQuestions && (
              <a
                href="/dashboard/question-bank"
                className="mt-2 block rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"
              >
                প্রশ্নব্যাংক পরিচালনা
              </a>
            )}

            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
              <a
                href="/login"
                className="rounded-lg bg-blue-50 px-3 py-3 text-center text-sm font-bold text-blue-700"
              >
                লগইন
              </a>

              <a
                href="/register"
                className="rounded-lg bg-blue-700 px-3 py-3 text-center text-sm font-bold text-white"
              >
                নিবন্ধন
              </a>
            </div>
          </nav>
        </details>
      </div>
    </header>
  );
}
