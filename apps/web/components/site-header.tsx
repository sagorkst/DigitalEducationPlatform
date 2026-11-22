
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AuthUser = {
  id?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getOptionalString(value: unknown): string | null | undefined {
  return typeof value === "string" || value === null ? value : undefined;
}

function getAuthenticatedUser(payload: unknown): AuthUser | null {
  const root = isRecord(payload) ? payload : {};
  const data = isRecord(root.data) ? root.data : {};

  const candidates = [
    data.user,
    data.account,
    root.user,
    root.account,
    root.data,
  ].filter(isRecord);

  for (const item of candidates) {
    const id = getOptionalString(item.id);
    const name = getOptionalString(item.name);
    const email = getOptionalString(item.email);
    const phone = getOptionalString(item.phone);

    if (id || name || email || phone) {
      return {
        id: id ?? undefined,
        name: name ?? undefined,
        email,
        phone,
        avatar: getOptionalString(item.avatar) ?? null,
      };
    }
  }

  return null;
}

function hasRole(payload: unknown, expectedRole: string): boolean {
  const root = isRecord(payload) ? payload : {};
  const data = isRecord(root.data) ? root.data : {};

  const candidates = [
    data.user,
    data.account,
    root.data,
    root.user,
    root.account,
  ].filter(isRecord);

  for (const item of candidates) {
    const roleValues: unknown[] = [
      item.role,
      ...(Array.isArray(item.roles) ? item.roles : []),
    ];

    const roles = roleValues
      .map((role) => {
        if (typeof role === "string") return role;
        if (!isRecord(role)) return null;
        return role.name ?? role.code ?? role.role;
      })
      .filter((role): role is string => typeof role === "string")
      .map((role) => role.toUpperCase());

    if (roles.includes(expectedRole)) return true;
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
  const router = useRouter();

  // null keeps the first server and client render identical.
  const [pathname, setPathname] = useState<string | null>(null);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    setPathname(window.location.pathname);

    function handleDocumentClick(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");

      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank") return;

      const destination = new URL(anchor.href, window.location.origin);

      if (destination.origin === window.location.origin) {
        setPathname(destination.pathname);
      }
    }

    function handlePopState() {
      setPathname(window.location.pathname);
    }

    document.addEventListener("click", handleDocumentClick);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleDocumentClick);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

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
            setIsSuperAdmin(false);
          }
          return;
        }

        const payload = await response.json();
        const authenticatedUser = getAuthenticatedUser(payload);

        if (!authenticatedUser) {
          if (active) {
            setUser(null);
            setIsSuperAdmin(false);
          }
          return;
        }

        let currentUser = authenticatedUser;
        let superAdminAccess = hasRole(payload, "SUPER_ADMIN");

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

              superAdminAccess =
                superAdminAccess ||
                hasRole(profilePayload, "SUPER_ADMIN");
            }
          }
        } catch {
          // Keep authenticated session if profile details cannot load.
        }

        if (active) {
          setUser(currentUser);
          setIsSuperAdmin(superAdminAccess);
        }
      } catch {
        if (active) {
          setUser(null);
          setIsSuperAdmin(false);
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
          result?.message ??
            "লগআউট করা যায়নি। আবার চেষ্টা করুন।",
        );
        return;
      }

      setUser(null);
      setIsSuperAdmin(false);
      setPathname("/");

      window.dispatchEvent(new Event("shikhasetu:auth-changed"));
      router.push("/");
    } catch {
      setLogoutError(
        "সার্ভারের সঙ্গে সংযোগ করা যাচ্ছে না।",
      );
    } finally {
      setLogoutLoading(false);
    }
  }

  const avatarUrl = getAvatarUrl(user?.avatar);

  function isActiveLink(href: string) {
    if (!pathname) return false;
    if (href === "/") return pathname === "/";

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-3 sm:px-5">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-lg text-white">
            🎓
          </span>

          <span className="whitespace-nowrap text-lg font-black tracking-tight text-slate-900">
            শিক্ষাসেতু
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav
          className="hidden min-w-0 flex-1 items-center justify-center gap-x-2 xl:flex"
          aria-label="প্রধান নেভিগেশন"
        >
          {links.map((link) => {
            const active = isActiveLink(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-md px-2.5 py-2 text-[13px] font-semibold transition-colors duration-200 ${
                  active
                    ? "bg-blue-50 text-blue-800"
                    : "text-slate-600 hover:bg-slate-100 hover:text-blue-700"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {authChecked && user && isSuperAdmin && (
            <Link
              href="/admin"
              className="hidden items-center gap-1.5 whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 lg:inline-flex"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M3 10.5 12 3l9 7.5" />
                <path d="M5 9v11h14V9" />
                <path d="M9 20v-6h6v6" />
              </svg>
              Admin Panel
            </Link>
          )}

          {!authChecked ? (
            <div className="h-10 w-20 animate-pulse rounded-md bg-slate-100" />
          ) : user ? (
            <div className="flex items-center overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
              <Link
                href="/dashboard/profile"
                className="flex items-center gap-2 px-2.5 py-2 transition-colors hover:bg-blue-50"
                aria-label="আমার প্রোফাইল"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-blue-700">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt="Profile"
                      width={32}
                      height={32}
                      unoptimized
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

                <span className="hidden whitespace-nowrap text-xs font-bold text-slate-700 sm:inline">
                  প্রোফাইল
                </span>
              </Link>

              <div className="h-7 w-px bg-slate-200" />

              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={logoutLoading}
                className="flex items-center gap-1.5 whitespace-nowrap px-2.5 py-2.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-4 w-4"
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
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              লগইন
            </Link>
          )}

          {/* Mobile Menu */}
          <details className="relative xl:hidden">
            <summary className="flex cursor-pointer list-none items-center rounded-md border border-slate-200 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-50">
              <span className="text-lg">☰</span>
            </summary>

            <nav
              className="absolute right-0 top-12 z-50 max-h-[75vh] w-72 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 shadow-xl"
              aria-label="মোবাইল নেভিগেশন"
            >
              {links.map((link) => {
                const active = isActiveLink(link.href);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`mb-1 block rounded-md px-4 py-3 text-sm font-semibold transition-colors duration-200 ${
                      active
                        ? "bg-blue-50 text-blue-800"
                        : "text-slate-700 hover:bg-slate-100 hover:text-blue-700"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}

              {authChecked && user && isSuperAdmin && (
                <Link
                  href="/admin"
                  className="mt-2 block rounded-md bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
                >
                  Admin Panel
                </Link>
              )}
            </nav>
          </details>
        </div>
      </div>

      {logoutError && (
        <div
          className="mx-auto max-w-7xl px-4 pb-2 text-right text-xs text-red-600"
          role="alert"
        >
          {logoutError}
        </div>
      )}
    </header>
  );
}
