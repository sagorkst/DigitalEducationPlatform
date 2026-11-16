import Link from "next/link";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-[75vh] bg-slate-50">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:px-8">
        <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-64 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Shikhasetu
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Admin Control
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Platform administration
              </p>
            </div>

            <nav aria-label="Admin navigation" className="space-y-1">
              <Link
                href="/admin"
                className="flex items-center rounded-xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <span className="mr-3 text-lg">▦</span>
                Dashboard
              </Link>

              <Link
                href="/admin/users"
                className="flex items-center rounded-xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-800"
              >
                <span className="mr-3 text-lg">♙</span>
                User Management
              </Link>
            </nav>

            <div className="mt-6 rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">
                Administration modules
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Role Management, Permission Management, Audit Logs and
                additional administration tools will be added in upcoming
                development batches.
              </p>
            </div>

            <Link
              href="/"
              className="mt-5 flex items-center rounded-xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <span className="mr-3">←</span>
              Back to website
            </Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
