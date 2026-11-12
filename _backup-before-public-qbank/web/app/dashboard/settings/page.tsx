"use client";

import { useState } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const [language, setLanguage] = useState("বাংলা");
  const [emailNotice, setEmailNotice] = useState(true);
  const [examNotice, setExamNotice] = useState(true);
  const [courseNotice, setCourseNotice] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [saved, setSaved] = useState(false);

  const inputClass = "mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none focus:border-blue-500";
  const labelClass = "text-sm font-semibold text-gray-600";

  function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
    return (
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-blue-600" : "bg-gray-300"}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? "left-6" : "left-1"}`} />
      </button>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-7">
          <Link href="/dashboard" className="text-sm font-medium text-blue-600 hover:underline">← ড্যাশবোর্ডে ফিরে যান</Link>
          <h1 className="mt-3 text-2xl font-bold text-gray-900 sm:text-3xl">অ্যাকাউন্ট সেটিংস</h1>
          <p className="mt-1 text-sm text-gray-500">আপনার অ্যাকাউন্ট, নিরাপত্তা ও পছন্দ নিয়ন্ত্রণ করুন।</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <aside className="h-fit rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-gray-900">সেটিংস মেনু</h2>
            <nav className="mt-4 space-y-2 text-sm">
              <a href="#account" className="block rounded-xl bg-blue-50 px-4 py-3 font-semibold text-blue-700">👤 সাধারণ সেটিংস</a>
              <a href="#password" className="block rounded-xl px-4 py-3 text-gray-600 hover:bg-gray-50">🔒 পাসওয়ার্ড ও নিরাপত্তা</a>
              <a href="#notifications" className="block rounded-xl px-4 py-3 text-gray-600 hover:bg-gray-50">🔔 নোটিফিকেশন</a>
              <a href="#privacy" className="block rounded-xl px-4 py-3 text-gray-600 hover:bg-gray-50">🛡️ প্রাইভেসি</a>
            </nav>
            <div className="mt-5 border-t border-gray-100 pt-4">
              <Link href="/dashboard/profile" className="text-sm font-semibold text-blue-600 hover:underline">প্রোফাইলে ফিরে যান →</Link>
            </div>
          </aside>

          <div className="space-y-6 lg:col-span-2">
            <section id="account" className="scroll-mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-7">
              <h2 className="text-lg font-bold text-gray-900">সাধারণ সেটিংস</h2>
              <p className="mt-1 text-sm text-gray-500">আপনার পছন্দ অনুযায়ী প্ল্যাটফর্ম ব্যবহার করুন।</p>
              <div className="mt-6 max-w-md">
                <label className={labelClass}>পছন্দের ভাষা</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputClass}>
                  <option>বাংলা</option>
                  <option>English</option>
                </select>
              </div>
            </section>

            <section id="password" className="scroll-mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-7">
              <h2 className="text-lg font-bold text-gray-900">পাসওয়ার্ড ও নিরাপত্তা</h2>
              <p className="mt-1 text-sm text-gray-500">অ্যাকাউন্ট সুরক্ষিত রাখতে শক্তিশালী পাসওয়ার্ড ব্যবহার করুন।</p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className={labelClass}>বর্তমান পাসওয়ার্ড
                  <input type={showPassword ? "text" : "password"} placeholder="বর্তমান পাসওয়ার্ড" className={inputClass} />
                </label>
                <label className={labelClass}>নতুন পাসওয়ার্ড
                  <input type={showPassword ? "text" : "password"} placeholder="নতুন পাসওয়ার্ড" className={inputClass} />
                </label>
              </div>
              <label className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                পাসওয়ার্ড দেখান
              </label>
              <p className="mt-3 text-xs text-gray-400">পাসওয়ার্ড পরিবর্তনের সুবিধা Backend যুক্ত হলে কার্যকর হবে।</p>
            </section>

            <section id="notifications" className="scroll-mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-7">
              <h2 className="text-lg font-bold text-gray-900">নোটিফিকেশন সেটিংস</h2>
              <p className="mt-1 text-sm text-gray-500">কোন ধরনের আপডেট পেতে চান তা নির্বাচন করুন।</p>
              <div className="mt-5 divide-y divide-gray-100">
                <div className="flex items-center justify-between gap-4 py-4">
                  <div><p className="text-sm font-semibold text-gray-800">ইমেইল নোটিফিকেশন</p><p className="mt-1 text-xs text-gray-500">গুরুত্বপূর্ণ আপডেট ইমেইলে পাওয়া</p></div>
                  <Toggle checked={emailNotice} onChange={setEmailNotice} />
                </div>
                <div className="flex items-center justify-between gap-4 py-4">
                  <div><p className="text-sm font-semibold text-gray-800">পরীক্ষা ও ফলাফল</p><p className="mt-1 text-xs text-gray-500">নতুন পরীক্ষা ও ফলাফলের আপডেট</p></div>
                  <Toggle checked={examNotice} onChange={setExamNotice} />
                </div>
                <div className="flex items-center justify-between gap-4 py-4">
                  <div><p className="text-sm font-semibold text-gray-800">কোর্স আপডেট</p><p className="mt-1 text-xs text-gray-500">নতুন কোর্স ও লেসনের খবর</p></div>
                  <Toggle checked={courseNotice} onChange={setCourseNotice} />
                </div>
              </div>
            </section>

            <section id="privacy" className="scroll-mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-7">
              <h2 className="text-lg font-bold text-gray-900">প্রাইভেসি ও অ্যাকাউন্ট</h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">আপনার ব্যক্তিগত তথ্য সুরক্ষিত রাখুন। অ্যাকাউন্ট মুছে ফেলার মতো গুরুত্বপূর্ণ কাজের জন্য ভবিষ্যতে পরিচয় যাচাই প্রয়োজন হবে।</p>
              <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4">
                <p className="font-semibold text-red-800">অ্যাকাউন্ট বন্ধ করা</p>
                <p className="mt-1 text-xs leading-5 text-red-700">এই সুবিধাটি এখনো চালু হয়নি। Backend ও নিরাপত্তা যাচাই যুক্ত হওয়ার পর এটি তৈরি করা হবে।</p>
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">{saved ? "এই সেশনে আপনার পছন্দগুলো আপডেট হয়েছে।" : "পরিবর্তনগুলো এই পেজে আপাতত সাময়িক থাকবে।"}</p>
              <button onClick={() => setSaved(true)} className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">পছন্দ সংরক্ষণ</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
