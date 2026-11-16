"use client";

import { useEffect, useState } from "react";

type AuthUser = {
  id?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
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
        avatar: item.avatar ?? null,
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

const API_ORIGIN = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000"
).replace(/\/api\/?$/, "");

function getAvatarUrl(avatar?: string | null) {
  if (!avatar) return null;

  if (/^https?:\/\//i.test(avatar)) {
    return avatar;
  }

  return `${API_ORIGIN}${avatar.startsWith("/") ? "" : "/"}${avatar}`;
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

        if (!authenticatedUser) {
          if (active) {
            setUser(null);
            setCanManageQuestions(false);
          }
          return;
        }

        let currentUser = authenticatedUser;

        try {
          const profileResponse = await fetch("/api/users/me", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
          });

          if (profileResponse.ok) {
            const profilePayload = await profileResponse.json();
            const profile = profilePayload?.data;

            if (profilePayload?.success && profile) {
              currentUser = {
                ...authenticatedUser,
                id: profile.id ?? authenticatedUser.id,
                name: profile.name ?? authenticatedUser.name,
                email: profile.email ?? authenticatedUser.email,
                phone: profile.phone ?? authenticatedUser.phone,
                avatar: profile.avatar ?? null,
              };
            }
          }
        } catch {
          // Keep authenticated session if profile details cannot load.
        }

        if (active) {
          setUser(currentUser);
          setCanManageQuestions(hasQuestionManagementAccess(payload));
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
      void checkSession();
    }

    void checkSession();

    window.addEventListener("shikhasetu:auth-changed", handleAuthChanged);

    return () => {
      active = false;
      window.removeEventListener("shikhasetu:auth-changed", handleAuthChanged);
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

      window.dispatchEvent(new Event("shikhasetu:auth-changed"));
      window.location.assign("/");
    } catch {
      setLogoutError("সার্ভারের সঙ্গে সংযোগ করা যাচ্ছে না।");
    } finally {
      setLogoutLoading(false);
    }
  }

  const avatarUrl = getAvatarUrl(user?.avatar);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
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

        <div className="flex shrink-0 items-center gap-3">
          {authChecked && user && canManageQuestions && (
            <a
              href="/dashboard/question-bank"
              className="hidden rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100 lg:inline-flex"
            >
              প্রশ্নব্যাংক পরিচালনা
            </a>
          )}

          {!authChecked ? (
            <div className="h-11 w-24 animate-pulse rounded-xl bg-slate-100" />
          ) : user ? (
            <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <a
                href="/dashboard/profile"
                className="flex items-center gap-2.5 px-3 py-2 transition hover:bg-blue-50 sm:px-4"
                aria-label="আমার প্রোফাইল"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-blue-700">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="8" r="3.5" />
                      <path d="M5 20c.6-3.5 3.3-5.5 7-5.5s6.4 2 7 5.5" />
                    </svg>
                  )}
                </span>

                <span className="hidden text-sm font-bold text-slate-700 sm:inline">
                  প্রোফাইল
                </span>
              </a>

              <div className="h-8 w-px bg-slate-200" />

              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={logoutLoading}
                className="flex items-center gap-2 px-3 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M10 17l5-5-5-5" />
                  <path d="M15 12H3" />
                  <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
                </svg>
                <span className="hidden sm:inline">
                  {logoutLoading ? "অপেক্ষা করুন..." : "লগআউট"}
                </span>
              </button>
            </div>
          ) : (
            <a
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 20c.6-3.5 3.3-5.5 7-5.5s6.4 2 7 5.5" />
              </svg>
              লগইন
            </a>
          )}

          <details className="relative xl:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
              <span className="hidden sm:inline">মেনু</span>
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
            </nav>
          </details>
        </div>
      </div>

      {logoutError && (
        <div className="mx-auto max-w-7xl px-4 pb-2 text-right text-xs text-red-600" role="alert">
          {logoutError}
        </div>
      )}
    </header>
  );
}
