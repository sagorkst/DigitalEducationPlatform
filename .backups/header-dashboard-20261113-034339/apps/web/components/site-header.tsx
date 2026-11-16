"use client";

import { useEffect, useState } from "react";

type AuthUser = {
  id?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
};

function getAuthenticatedUser(payload: any): AuthUser | null {
  const candidates = [
    payload?.data?.user,
    payload?.data?.account,
    payload?.user,
    payload?.account,
    payload?.data,
  ].filter(Boolean);

  for (const item of candidates) {
    if (
      typeof item === "object" &&
      (item.id || item.name || item.email || item.phone)
    ) {
      return {
        id: item.id,
        name: item.name,
        email: item.email,
        phone: item.phone,
      };
    }
  }

  return null;
}

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
      .filter(Boolean)
      .map((role: string) => role.toUpperCase());

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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [canManageQuestions, setCanManageQuestions] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });

        if (!response.ok) {
          if (active) {
            setUser(null);
            setCanManageQuestions(false);
          }
          return;
        }

        const payload = await response.json();
        const authenticatedUser = getAuthenticatedUser(payload);

        if (active) {
          setUser(authenticatedUser);
          setCanManageQuestions(
            authenticatedUser
              ? hasQuestionManagementAccess(payload)
              : false,
          );
        }
      } catch {
        if (active) {
          setUser(null);
          setCanManageQuestions(false);
        }
      } finally {
        if (active) {
          setAuthChecked(true);
        }
      }
    }

    function handleAuthChanged() {
      setAuthChecked(false);
      checkSession();
    }

    checkSession();

    window.addEventListener("shikhasetu:auth-changed", handleAuthChanged);

    return () => {
      active = false;
      window.removeEventListener(
        "shikhasetu:auth-changed",
        handleAuthChanged,
      );
    };
  }, []);

  async function handleLogout() {
    if (logoutLoading) return;

    setLogoutLoading(true);
    setLogoutError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        setLogoutError(
          result?.message ?? "Logout করা যায়নি। আবার চেষ্টা করুন।",
        );
        return;
      }

      setUser(null);
      setCanManageQuestions(false);
      setLogoutError("");

      window.location.assign("/");
    } catch {
      setLogoutError("সার্ভারের সঙ্গে সংযোগ করা যাচ্ছে না।");
    } finally {
      setLogoutLoading(false);
    }
  }

  function AuthActions({ mobile = false }: { mobile?: boolean }) {
    if (!authChecked) return null;

    if (!user) {
      return mobile ? (
        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
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
      ) : (
        <>
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
        </>
      );
    }

    return mobile ? (
      <div className="mt-2 space-y-2 border-t border-slate-100 pt-3">
        <a
          href="/dashboard"
          className="block rounded-lg bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800"
        >
          👤 প্রোফাইল / ড্যাশবোর্ড
        </a>
        <button
          type="button"
          onClick={handleLogout}
          disabled={logoutLoading}
          className="w-full rounded-lg bg-red-50 px-4 py-3 text-left text-sm font-bold text-red-700 disabled:opacity-60"
        >
          {logoutLoading ? "Logout হচ্ছে..." : "Logout"}
        </button>
        {logoutError && (
          <p role="alert" className="px-2 text-xs text-red-600">
            {logoutError}
          </p>
        )}
      </div>
    ) : (
      <>
        <a
          href="/dashboard"
          className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-800 transition hover:bg-blue-100"
        >
          👤 প্রোফাইল
        </a>
        <button
          type="button"
          onClick={handleLogout}
          disabled={logoutLoading}
          className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {logoutLoading ? "Logout হচ্ছে..." : "Logout"}
        </button>
      </>
    );
  }

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
          {authChecked && user && canManageQuestions && (
            <a
              href="/dashboard/question-bank"
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800"
            >
              প্রশ্নব্যাংক পরিচালনা
            </a>
          )}

          <AuthActions />
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

            {authChecked && user && canManageQuestions && (
              <a
                href="/dashboard/question-bank"
                className="mt-2 block rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"
              >
                প্রশ্নব্যাংক পরিচালনা
              </a>
            )}

            <AuthActions mobile />
          </nav>
        </details>
      </div>
    </header>
  );
}
