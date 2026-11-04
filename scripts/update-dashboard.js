const fs = require("fs");
const file = "apps/web/app/dashboard/page.tsx";
let s = fs.readFileSync(file, "utf8");

s = '"use client";\nimport { useState } from "react";\n\n' + s;

s = s.replace(
  'export default function DashboardPage() {\n  return (',
  'export default function DashboardPage() {\n  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);\n  const [profileOpen, setProfileOpen] = useState(false);\n\n  return ('
);

const sidebar = '        <aside className="hidden min-h-screen w-64 shrink-0 border-r border-slate-200 bg-white p-5 lg:block">';
const mobileSidebar = `        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="মেনু বন্ধ করুন"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute inset-0 bg-slate-900/40"
            />
            <aside className="relative h-full w-72 max-w-[85%] overflow-y-auto bg-white p-5 shadow-xl">
              <div className="mb-8 flex items-center justify-between">
                <a href="/" className="text-xl font-black text-blue-700">🎓 শিক্ষাসেতু</a>
                <button type="button" onClick={() => setMobileMenuOpen(false)} className="rounded-lg p-2 text-xl text-slate-500">✕</button>
              </div>
              <p className="mb-4 text-xs font-bold tracking-wider text-slate-400">MAIN MENU</p>
              <nav className="space-y-2">
                {menuItems.map((item) => (
                  <a key={item.label} href={item.href || "/dashboard"}
                    onClick={() => setMobileMenuOpen(false)}
                    className={\`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold \${item.active ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}\`}>
                    <span>{item.icon}</span>{item.label}
                  </a>
                ))}
              </nav>
              <a href="/" className="mt-10 block text-sm font-semibold text-slate-500">← মূল ওয়েবসাইটে ফিরুন</a>
            </aside>
          </div>
        )}
`;
if (!s.includes(sidebar)) throw new Error("Desktop sidebar section not found");
s = s.replace(sidebar, mobileSidebar + sidebar);

const headerStart = '          <header className="mb-8 flex flex-wrap items-center justify-between gap-4">';
s = s.replace(headerStart, headerStart + `
            <button type="button" onClick={() => setMobileMenuOpen(true)}
              aria-label="মেনু খুলুন"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xl text-slate-700 lg:hidden">
              ☰
            </button>`);

const profileOld = `              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 pr-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
                  শি
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">শিক্ষার্থী</p>
                  <p className="text-xs text-slate-500">সাধারণ অ্যাকাউন্ট</p>
                </div>
              </div>`;
const profileNew = `              <div className="relative">
                <button type="button" onClick={() => setProfileOpen(!profileOpen)}
                  aria-expanded={profileOpen}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 pr-4 text-left hover:bg-slate-50">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">শি</span>
                  <span>
                    <span className="block text-sm font-bold text-slate-800">শিক্ষার্থী</span>
                    <span className="block text-xs text-slate-500">সাধারণ অ্যাকাউন্ট</span>
                  </span>
                  <span className="text-slate-400">⌄</span>
                </button>
                {profileOpen && (
                  <div className="absolute right-0 top-full z-40 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                    <a href="/dashboard" className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">👤 আমার প্রোফাইল</a>
                    <a href="/dashboard" className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">⚙️ সেটিংস</a>
                    <div className="my-1 border-t border-slate-100" />
                    <a href="/login" className="block rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">↪ লগআউট</a>
                  </div>
                )}
              </div>`;
if (!s.includes(profileOld)) throw new Error("Profile section not found");
s = s.replace(profileOld, profileNew);

fs.writeFileSync(file, s, "utf8");
console.log("Dashboard mobile menu and profile dropdown added.");
