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
  { label: "à¦¹à§‹à¦®", href: "/" },
  { label: "à¦à¦•à¦¾à¦¡à§‡à¦®à¦¿à¦•", href: "/academic" },
  { label: "à¦šà¦¾à¦•à¦°à¦¿ à¦ªà§à¦°à¦¸à§à¦¤à§à¦¤à¦¿", href: "/career" },
  { label: "à¦­à¦°à§à¦¤à¦¿", href: "/admission" },
  { label: "à¦¦à¦•à§à¦·à¦¤à¦¾ à¦‰à¦¨à§à¦¨à§Ÿà¦¨", href: "/skills" },
  { label: "à¦•à§‹à¦°à§à¦¸", href: "/courses" },
  { label: "à¦ªà§à¦°à¦¶à§à¦¨à¦¬à§à¦¯à¦¾à¦‚à¦•", href: "/question-bank" },
  { label: "à¦ªà¦°à§€à¦•à§à¦·à¦¾", href: "/exams" },
  { label: "à¦²à¦¾à¦‡à¦¬à§à¦°à§‡à¦°à¦¿", href: "/library" },
];

export default function SiteHeader() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
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
          result?.message ?? "Logout à¦•à¦°à¦¾ à¦¯à¦¾à§Ÿà¦¨à¦¿à¥¤ à¦†à¦¬à¦¾à¦° à¦šà§‡à¦·à§à¦Ÿà¦¾ à¦•à¦°à§à¦¨à¥¤",
        );
        return;
      }

      setUser(null);
      setIsSuperAdmin(false);

      window.dispatchEvent(new Event("shikhasetu:auth-changed"));
      router.push("/");
    } catch {
      setLogoutError("à¦¸à¦¾à¦°à§à¦­à¦¾à¦°à§‡à¦° à¦¸à¦™à§à¦—à§‡ à¦¸à¦‚à¦¯à§‹à¦— à¦•à¦°à¦¾ à¦¯à¦¾à¦šà§à¦›à§‡ à¦¨à¦¾à¥¤");
    } finally {
      setLogoutLoading(false);
    }
  }

  const avatarUrl = getAvatarUrl(user?.avatar);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-xl text-white">
            ðŸŽ“
          </span>
          <span className="text-xl font-black tracking-tight text-slate-900">
            à¦¶à¦¿à¦•à§à¦·à¦¾à¦¸à§‡à¦¤à§
          </span>
        </Link>

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
          {authChecked && user && isSuperAdmin && (
            <a
              href="/admin"
              className="hidden items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100 lg:inline-flex"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M3 10.5 12 3l9 7.5" />
                <path d="M5 9v11h14V9" />
                <path d="M9 20v-6h6v6" />
              </svg>
              Admin Panel
            </a>
          )}

          {!authChecked ? (
            <div className="h-11 w-24 animate-pulse rounded-xl bg-slate-100" />
          ) : user ? (
            <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <a
                href="/dashboard/profile"
                className="flex items-center gap-2.5 px-3 py-2 transition hover:bg-blue-50 sm:px-4"
                aria-label="à¦†à¦®à¦¾à¦° à¦ªà§à¦°à§‹à¦«à¦¾à¦‡à¦²"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-blue-700">
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt="Profile" width={32} height={32} unoptimized className="h-full w-full object-cover" />
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
                  à¦ªà§à¦°à§‹à¦«à¦¾à¦‡à¦²
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
                  {logoutLoading ? "à¦…à¦ªà§‡à¦•à§à¦·à¦¾ à¦•à¦°à§à¦¨..." : "à¦²à¦—à¦†à¦‰à¦Ÿ"}
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
              à¦²à¦—à¦‡à¦¨
            </a>
          )}

          <details className="relative xl:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
              <span className="hidden sm:inline">à¦®à§‡à¦¨à§</span>
              <span className="text-lg">â˜°</span>
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

              {authChecked && user && isSuperAdmin && (
                <a
                  href="/admin"
                  className="mt-2 block rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"
                >
                  Admin Panel
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