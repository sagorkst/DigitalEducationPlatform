"use client";

export default function QuestionImportTemplates() {
  return (
    <details className="group relative">
      <summary className="flex h-10 w-full cursor-pointer list-none items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50/50 [&::-webkit-details-marker]:hidden">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-5 w-5 text-emerald-600"
        >
          <path
            d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M14 3v5h5M8 13h8M8 17h8"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>

        <span>Import Templates</span>

        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-4 w-4 text-slate-400 transition group-open:rotate-180"
        >
          <path
            d="m7 10 5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>

      <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
        <div className="px-3 py-2">
          <p className="text-sm font-bold text-slate-900">
            Download Import Template
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Choose a format to download the question template.
          </p>
        </div>

        <a
          href="/api/imports/template?format=xlsx"
          className="flex items-center gap-3 rounded-lg p-3 transition hover:bg-emerald-50"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-xs font-black text-emerald-700">
            XLSX
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-800">
              Excel Template
            </span>
            <span className="block text-xs text-slate-500">
              Download Excel file
            </span>
          </span>
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-emerald-600">
            <path d="M12 3v12m0 0 5-5m-5 5-5-5M5 17v3h14v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>

        <a
          href="/api/imports/template?format=csv"
          className="flex items-center gap-3 rounded-lg p-3 transition hover:bg-blue-50"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-xs font-black text-blue-700">
            CSV
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-800">
              CSV Template
            </span>
            <span className="block text-xs text-slate-500">
              Download CSV file
            </span>
          </span>
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-blue-600">
            <path d="M12 3v12m0 0 5-5m-5 5-5-5M5 17v3h14v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
    </details>
  );
}