"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  {
    title: "OVERVIEW",
    items: [
      { href: "/admin", label: "Dashboard", icon: "▦" },
      { href: "/admin/analytics", label: "Analytics & Reports", icon: "▥" },
      { href: "/admin/audit-logs", label: "Audit Trail", icon: "◷" },
    ],
  },
  {
    title: "CONTENT MANAGEMENT",
    items: [
      { href: "/admin/questions", label: "Question Bank", icon: "❖" },
      { href: "/admin/exams", label: "Exams & Posts", icon: "▣" },
      { href: "/admin/institutions", label: "Institutions", icon: "▤" },
      { href: "/admin/academic", label: "Academic Management", icon: "▧" },
    ],
  },
  {
    title: "ACCESS MANAGEMENT",
    items: [
      { href: "/admin/users", label: "Users", icon: "♙" },
      { href: "/admin/roles", label: "Roles", icon: "⚙" },
      { href: "/admin/permissions", label: "Permissions", icon: "♧" },
      { href: "/admin/role-assignments", label: "Role Assignments", icon: "♧" },
    ],
  },
];

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  return (
    <div className="min-h-[80vh] bg-slate-100">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-5 px-3 py-4 sm:px-5 lg:flex-row lg:gap-6 lg:px-6 lg:py-6">
        <aside className="w-full shrink-0 lg:sticky lg:top-5 lg:w-[270px] lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-xl shadow-slate-900/10">
            <div className="border-b border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/70 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400 text-xl font-black text-slate-950 shadow-lg shadow-emerald-950/30">
                  S
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                    Shikhasetu
                  </p>
                  <h2 className="mt-0.5 text-lg font-bold tracking-tight">
                    Control Center
                  </h2>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-white">Platform Admin</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">Management workspace</p>
                </div>
                <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                  Secure
                </span>
              </div>
            </div>

            <nav aria-label="Admin navigation" className="space-y-5 p-3">
              {navigation.map((group) => (
                <div key={group.title}>
                  <p className="px-3 pb-2 text-[10px] font-bold tracking-[0.16em] text-slate-500">
                    {group.title}
                  </p>
                  <div className="space-y-1">
                    {group.items.map((link) => {
                      const isActive =
                        pathname === link.href ||
                        (link.href !== "/admin" && pathname.startsWith(link.href + "/"));

                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          aria-current={isActive ? "page" : undefined}
                          className={`group flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${isActive ? "bg-emerald-400 text-slate-950 shadow-md shadow-emerald-950/20" : "text-slate-300 hover:bg-white/8 hover:text-white"}`}
                        >
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-base ${isActive ? "bg-slate-950/10" : "bg-white/5 text-emerald-300 group-hover:bg-white/10"}`}>
                            {link.icon}
                          </span>
                          <span className="truncate">{link.label}</span>
                          {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-slate-950" />}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="border-t border-white/10 p-4">
              <Link
                href="/"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/8 hover:text-white"
              >
                <span className="text-lg">←</span>
                Back to website
              </Link>
              <p className="mt-3 px-3 text-[10px] leading-4 text-slate-500">
                Shikhasetu administration · Protected workspace
              </p>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
