"use client";
import { useState } from "react";

﻿const menuItems = [
  { icon: "🏠", label: "ড্যাশবোর্ড", active: true },
  { icon: "📚", label: "আমার কোর্স", href: "/courses" },
  { icon: "📝", label: "অনলাইন পরীক্ষা", href: "/exams" },
  { icon: "📖", label: "প্রশ্নব্যাংক", href: "/question-bank" },
  { icon: "🎓", label: "একাডেমিক", href: "/academic" },
  { icon: "💼", label: "চাকরির প্রস্তুতি", href: "/career" },
  { icon: "📢", label: "নোটিশ", href: "/notices" },
];

const stats = [
  { label: "মোট কোর্স", value: "08", icon: "📚", color: "bg-blue-50 text-blue-700" },
  { label: "সম্পন্ন পরীক্ষা", value: "24", icon: "📝", color: "bg-emerald-50 text-emerald-700" },
  { label: "গড় নম্বর", value: "82%", icon: "🏆", color: "bg-amber-50 text-amber-700" },
  { label: "পড়াশোনার সময়", value: "36 ঘন্টা", icon: "⏱️", color: "bg-purple-50 text-purple-700" },
];

const courses = [
  { title: "বাংলা ব্যাকরণ ও সাহিত্য", category: "চাকরির প্রস্তুতি", progress: 75, color: "bg-blue-600" },
  { title: "English Grammar", category: "ভাষা শিক্ষা", progress: 55, color: "bg-emerald-500" },
  { title: "সাধারণ জ্ঞান", category: "প্রতিযোগিতামূলক পরীক্ষা", progress: 35, color: "bg-amber-500" },
];

const exams = [
  { title: "বাংলা মডেল টেস্ট - ০১", date: "২ নভেম্বর ২০২৬", score: "৮৫/১০০", result: "ভালো" },
  { title: "English Practice Test", date: "৩০ অক্টোবর ২০২৬", score: "৭৮/১০০", result: "ভালো" },
  { title: "সাধারণ জ্ঞান পরীক্ষা", date: "২৮ অক্টোবর ২০২৬", score: "৯০/১০০", result: "চমৎকার" },
];

export default function DashboardPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-[1600px]">
        {mobileMenuOpen && (
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
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${item.active ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                    <span>{item.icon}</span>{item.label}
                  </a>
                ))}
              </nav>
              <a href="/" className="mt-10 block text-sm font-semibold text-slate-500">← মূল ওয়েবসাইটে ফিরুন</a>
            </aside>
          </div>
        )}
        <aside className="hidden min-h-screen w-64 shrink-0 border-r border-slate-200 bg-white p-5 lg:block">
          <a href="/" className="mb-10 flex items-center gap-2 text-xl font-black text-blue-700">
            🎓 শিক্ষাসেতু
          </a>

          <p className="mb-4 text-xs font-bold tracking-wider text-slate-400">
            MAIN MENU
          </p>

          <nav className="space-y-2">
            {menuItems.map((item) => (
              <a
                key={item.label}
                href={item.href || "/dashboard"}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  item.active
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="mt-12 rounded-2xl bg-blue-50 p-4">
            <p className="font-bold text-slate-800">আরও শিখুন!</p>
            <p className="mt-2 text-xs leading-6 text-slate-500">
              নিয়মিত অনুশীলন করুন এবং নিজের দক্ষতা বাড়ান।
            </p>
            <a href="/courses" className="mt-3 inline-block text-sm font-bold text-blue-700">
              কোর্স দেখুন →
            </a>
          </div>

          <a href="/" className="mt-10 block text-sm font-semibold text-slate-500 hover:text-blue-700">
            ← মূল ওয়েবসাইটে ফিরুন
          </a>
        </aside>

        <div className="min-w-0 flex-1 p-5 sm:p-8">
          <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <button type="button" onClick={() => setMobileMenuOpen(true)}
              aria-label="মেনু খুলুন"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xl text-slate-700 lg:hidden">
              ☰
            </button>
            <div>
              <p className="text-sm font-medium text-slate-500">সোমবার, ২ নভেম্বর ২০২৬</p>
              <h1 className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">
                স্বাগতম, শিক্ষার্থী! 👋
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                আজকের পড়াশোনা ও অগ্রগতির সংক্ষিপ্ত চিত্র।
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <button type="button"
                  onClick={() => setNotificationOpen(!notificationOpen)}
                  aria-label="নোটিফিকেশন"
                  aria-expanded={notificationOpen}
                  className="relative rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50">
                  🔔
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
                </button>
                {notificationOpen && (
                  <div className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[90vw] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="font-black text-slate-900">নোটিফিকেশন</h3>
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">৩টি নতুন</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      <div className="flex gap-3 py-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50">📝</span>
                        <div>
                          <p className="text-sm font-bold text-slate-800">নতুন মডেল টেস্ট উপলভ্য</p>
                          <p className="mt-1 text-xs text-slate-500">বাংলা মডেল টেস্ট - ০২ এখন অনুশীলন করতে পারবেন।</p>
                          <p className="mt-1 text-xs text-slate-400">১০ মিনিট আগে</p>
                        </div>
                      </div>
                      <div className="flex gap-3 py-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50">📚</span>
                        <div>
                          <p className="text-sm font-bold text-slate-800">কোর্সের নতুন পাঠ যোগ হয়েছে</p>
                          <p className="mt-1 text-xs text-slate-500">English Grammar কোর্সে নতুন পাঠ যুক্ত হয়েছে।</p>
                          <p className="mt-1 text-xs text-slate-400">গতকাল</p>
                        </div>
                      </div>
                      <div className="flex gap-3 py-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50">📢</span>
                        <div>
                          <p className="text-sm font-bold text-slate-800">নতুন নোটিশ প্রকাশিত</p>
                          <p className="mt-1 text-xs text-slate-500">শিক্ষাসেতুর সর্বশেষ নোটিশ দেখে নিন।</p>
                          <p className="mt-1 text-xs text-slate-400">২ দিন আগে</p>
                        </div>
                      </div>
                    </div>
                    <a href="/notices" className="mt-2 block rounded-lg bg-blue-50 px-3 py-2 text-center text-sm font-bold text-blue-700 hover:bg-blue-100">
                      সব নোটিশ দেখুন →
                    </a>
                  </div>
                )}
              </div>
              <div className="relative">
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
              </div>
            </div>
          </header>

          <section className="mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl ${stat.color}`}>
                  {stat.icon}
                </div>
                <p className="mt-5 text-sm font-medium text-slate-500">{stat.label}</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{stat.value}</p>
              </div>
            ))}
          </section>

          <section className="mb-8 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <div className="rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 p-7 text-white shadow-lg">
              <p className="text-sm font-bold text-blue-100">YOUR LEARNING JOURNEY</p>
              <h2 className="mt-3 text-2xl font-black">প্রতিদিন একটু একটু করে এগিয়ে যান!</h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-blue-100">
                নিয়মিত পড়াশোনা, অনুশীলন ও পরীক্ষার মাধ্যমে আপনার লক্ষ্যে পৌঁছানোর প্রস্তুতি নিন।
              </p>
              <a href="/courses" className="mt-6 inline-block rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50">
                শেখা শুরু করুন →
              </a>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-black text-slate-900">আজকের লক্ষ্য</h2>
              <p className="mt-2 text-sm text-slate-500">আপনার দৈনিক পড়াশোনার লক্ষ্য</p>
              <div className="my-6 flex items-center gap-5">
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-[8px] border-blue-100 border-t-blue-600 text-xl font-black text-slate-800">
                  60%
                </div>
                <div>
                  <p className="text-lg font-black text-slate-900">৩ / ৫ ঘণ্টা</p>
                  <p className="mt-1 text-xs text-slate-500">আজকের পড়াশোনা</p>
                </div>
              </div>
              <p className="text-xs font-medium text-emerald-600">আরও ২ ঘণ্টা পড়াশোনা বাকি</p>
            </div>
          </section>

          <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900">চলমান কোর্স</h2>
                <p className="mt-1 text-sm text-slate-500">আপনার শেখার অগ্রগতি</p>
              </div>
              <a href="/courses" className="text-sm font-bold text-blue-700">সব কোর্স দেখুন →</a>
            </div>

            <div className="space-y-6">
              {courses.map((course) => (
                <div key={course.title}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-800">{course.title}</h3>
                      <p className="mt-1 text-xs text-slate-500">{course.category}</p>
                    </div>
                    <span className="text-sm font-black text-slate-700">{course.progress}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${course.color}`} style={{ width: `${course.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900">সাম্প্রতিক পরীক্ষার ফলাফল</h2>
                <p className="mt-1 text-sm text-slate-500">আপনার সর্বশেষ অনুশীলনের ফলাফল</p>
              </div>
              <a href="/exams" className="text-sm font-bold text-blue-700">সব পরীক্ষা →</a>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[550px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500">
                    <th className="px-3 py-3 font-semibold">পরীক্ষার নাম</th>
                    <th className="px-3 py-3 font-semibold">তারিখ</th>
                    <th className="px-3 py-3 font-semibold">প্রাপ্ত নম্বর</th>
                    <th className="px-3 py-3 font-semibold">অবস্থা</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map((exam) => (
                    <tr key={exam.title} className="border-b border-slate-50 last:border-0">
                      <td className="px-3 py-4 font-bold text-slate-800">{exam.title}</td>
                      <td className="px-3 py-4 text-slate-500">{exam.date}</td>
                      <td className="px-3 py-4 font-bold text-slate-800">{exam.score}</td>
                      <td className="px-3 py-4">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                          {exam.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-slate-900">দ্রুত প্রবেশ</h2>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <a href="/question-bank" className="rounded-xl bg-blue-50 p-4 text-sm font-bold text-blue-700 hover:bg-blue-100">📖 প্রশ্নব্যাংক</a>
                <a href="/exams" className="rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700 hover:bg-emerald-100">📝 পরীক্ষা</a>
                <a href="/library" className="rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-700 hover:bg-amber-100">📚 লাইব্রেরি</a>
                <a href="/notices" className="rounded-xl bg-purple-50 p-4 text-sm font-bold text-purple-700 hover:bg-purple-100">📢 নোটিশ</a>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-slate-900">সাম্প্রতিক কার্যক্রম</h2>
              <div className="mt-5 space-y-5">
                <div className="flex gap-3">
                  <span className="text-xl">✅</span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">বাংলা মডেল টেস্ট সম্পন্ন করেছেন</p>
                    <p className="mt-1 text-xs text-slate-400">আজ, সকাল ১০:৩০</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="text-xl">📚</span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">English Grammar কোর্সে অগ্রগতি</p>
                    <p className="mt-1 text-xs text-slate-400">গতকাল</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="text-xl">🎯</span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">দৈনিক পড়াশোনার লক্ষ্য নির্ধারণ</p>
                    <p className="mt-1 text-xs text-slate-400">২ দিন আগে</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <footer className="mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
            © ২০২৬ শিক্ষাসেতু। সর্বস্বত্ব সংরক্ষিত।
          </footer>
        </div>
      </div>
    </main>
  );
}
