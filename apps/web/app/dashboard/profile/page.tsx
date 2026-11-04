"use client";

import { useState } from "react";
import Link from "next/link";

export default function ProfilePage() {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("আপনার নাম");
  const [email, setEmail] = useState("your@email.com");
  const [phone, setPhone] = useState("01XXXXXXXXX");
  const [address, setAddress] = useState("আপনার ঠিকানা");
  const [education, setEducation] = useState("শিক্ষাগত যোগ্যতা লিখুন");
  const [profession, setProfession] = useState("শিক্ষার্থী / চাকরিপ্রার্থী");

  const fieldClass = "mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none focus:border-blue-500";
  const labelClass = "text-sm font-semibold text-gray-600";

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-sm font-medium text-blue-600 hover:underline">← ড্যাশবোর্ডে ফিরে যান</Link>
            <h1 className="mt-3 text-2xl font-bold text-gray-900 sm:text-3xl">আমার প্রোফাইল</h1>
            <p className="mt-1 text-sm text-gray-500">আপনার ব্যক্তিগত তথ্য ও প্রোফাইল পরিচালনা করুন।</p>
          </div>
          <button onClick={() => setEditing(!editing)} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
            {editing ? "সম্পাদনা বন্ধ করুন" : "✎ প্রোফাইল সম্পাদনা"}
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="space-y-6">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-blue-100 text-4xl">👤</div>
              <h2 className="mt-4 text-xl font-bold text-gray-900">{name}</h2>
              <p className="mt-1 text-sm text-gray-500">{profession}</p>
              <span className="mt-4 inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">সাধারণ সদস্য</span>
              <div className="mt-6 border-t border-gray-100 pt-5 text-left">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-600">প্রোফাইল সম্পূর্ণতা</span>
                  <span className="font-bold text-blue-600">৬০%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full w-[60%] rounded-full bg-blue-600" />
                </div>
                <p className="mt-3 text-xs leading-5 text-gray-500">আপনার বাকি তথ্য যোগ করে প্রোফাইল সম্পূর্ণ করুন।</p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-gray-900">প্রোফাইল মেনু</h3>
              <div className="mt-4 space-y-2 text-sm">
                <Link href="/dashboard/profile" className="block rounded-xl bg-blue-50 px-4 py-3 font-semibold text-blue-700">👤 ব্যক্তিগত তথ্য</Link>
                <Link href="/dashboard/settings" className="block rounded-xl px-4 py-3 text-gray-600 hover:bg-gray-50">⚙️ অ্যাকাউন্ট সেটিংস</Link>
                <Link href="/dashboard" className="block rounded-xl px-4 py-3 text-gray-600 hover:bg-gray-50">▦ ড্যাশবোর্ড</Link>
              </div>
            </div>
          </section>

          <section className="lg:col-span-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-7 border-b border-gray-100 pb-5">
                <h2 className="text-lg font-bold text-gray-900">ব্যক্তিগত তথ্য</h2>
                <p className="mt-1 text-sm text-gray-500">আপনার সঠিক তথ্য দিয়ে প্রোফাইল আপডেট করুন।</p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <label className={labelClass}>সম্পূর্ণ নাম
                  <input className={fieldClass} value={name} readOnly={!editing} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className={labelClass}>ইমেইল ঠিকানা
                  <input type="email" className={fieldClass} value={email} readOnly={!editing} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label className={labelClass}>মোবাইল নম্বর
                  <input className={fieldClass} value={phone} readOnly={!editing} onChange={(e) => setPhone(e.target.value)} />
                </label>
                <label className={labelClass}>পেশা / পরিচয়
                  <input className={fieldClass} value={profession} readOnly={!editing} onChange={(e) => setProfession(e.target.value)} />
                </label>
                <label className={`${labelClass} sm:col-span-2`}>ঠিকানা
                  <input className={fieldClass} value={address} readOnly={!editing} onChange={(e) => setAddress(e.target.value)} />
                </label>
                <label className={`${labelClass} sm:col-span-2`}>শিক্ষাগত যোগ্যতা
                  <input className={fieldClass} value={education} readOnly={!editing} onChange={(e) => setEducation(e.target.value)} />
                </label>
              </div>

              {editing && (
                <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-6">
                  <button onClick={() => setEditing(false)} className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50">বন্ধ করুন</button>
                  <button onClick={() => setEditing(false)} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">পরিবর্তন সম্পন্ন</button>
                </div>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <h3 className="font-bold text-blue-900">💡 প্রোফাইল টিপস</h3>
              <p className="mt-2 text-sm leading-6 text-blue-800">সঠিক নাম, যোগাযোগের তথ্য এবং শিক্ষাগত যোগ্যতা যুক্ত রাখুন। ভবিষ্যতে কোর্স, পরীক্ষা ও সার্টিফিকেট ব্যবস্থাপনায় এই তথ্য কাজে লাগবে।</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
