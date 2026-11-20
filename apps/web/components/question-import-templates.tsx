"use client";

import { useEffect, useRef } from "react";

export default function QuestionImportTemplates() {
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !menuRef.current?.contains(target)) {
        if (menuRef.current) menuRef.current.open = false;
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menuRef.current?.open) {
        menuRef.current.open = false;
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const closeMenu = () => {
    if (menuRef.current) menuRef.current.open = false;
  };

  return (
    <details ref={menuRef} className="group relative h-full w-full overflow-visible">
      <summary className="flex h-full w-full cursor-pointer list-none flex-col items-center justify-start gap-2 rounded-md bg-transparent px-1 pt-3 text-center text-slate-800 outline-none transition-colors hover:bg-violet-100/80 focus:outline-none focus-visible:outline-none focus-visible:ring-0 [&::-webkit-details-marker]:hidden">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center text-violet-700">
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
            <path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            <path d="M14 3v5h5M8 13h8M8 17h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </span>
        <span className="flex min-w-0 flex-col text-center text-base font-black leading-tight text-slate-900">
          <span>Template</span>
          <span>Download</span>
        </span>
        <svg viewBox="0 0 24 24" fill="none" className="hidden h-3.5 w-3.5 shrink-0 text-slate-400 transition group-open:rotate-180">
          <path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      <div className="absolute right-0 top-full z-[80] mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
        <div className="px-2 py-1.5">
          <p className="text-xs font-bold text-slate-900">Download Import Template</p>
          <p className="mt-0.5 text-[10px] text-slate-500">আপনার প্রয়োজনীয় ফরম্যাট বেছে নিন।</p>
        </div>

        <a
          href="/api/imports/template?format=xlsx"
          onClick={closeMenu}
          className="flex items-center gap-2.5 rounded-lg p-2 transition hover:bg-emerald-50"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100 text-[10px] font-black text-emerald-700">XLSX</span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-slate-800">Excel Template</span>
            <span className="block text-[10px] text-slate-500">Download Excel file</span>
          </span>
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-emerald-600">
            <path d="M12 3v12m0 0 5-5m-5 5-5-5M5 17v3h14v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>

        <a
          href="/api/imports/template?format=csv"
          onClick={closeMenu}
          className="flex items-center gap-2.5 rounded-lg p-2 transition hover:bg-blue-50"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-[10px] font-black text-blue-700">CSV</span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-slate-800">CSV Template</span>
            <span className="block text-[10px] text-slate-500">Download CSV file</span>
          </span>
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-blue-600">
            <path d="M12 3v12m0 0 5-5m-5 5-5-5M5 17v3h14v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
    </details>
  );
}
