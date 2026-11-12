"use client";

import { useState } from "react";
import Link from "next/link";

const courses = [
  {
    id: 1,
    title: "বাংলা ব্যাকরণ ও সাহিত্য",
    category: "চাকরি প্রস্তুতি",
    instructor: "শিক্ষাসেতু একাডেমি",
    progress: 75,
    lessons: "৩০ / ৪০",
    duration: "১২ ঘণ্টা",
    color: "bg-blue-500",
    icon: "📚",
    status: "চলমান",
  },
  {
    id: 2,
    title: "English Grammar & Vocabulary",
    category: "চাকরি প্রস্তুতি",
    instructor: "শিক্ষাসেতু একাডেমি",
    progress: 45,
    lessons: "১৮ / ৪০",
    duration: "১৫ ঘণ্টা",
    color: "bg-violet-500",
    icon: "📝",
    status: "চলমান",
  },
  {
    id: 3,
    title: "সাধারণ গণিত",
    category: "চাকরি প্রস্তুতি",
    instructor: "শিক্ষাসেতু একাডেমি",
    progress: 100,
    lessons: "২৫ / ২৫",
    duration: "১০ ঘণ্টা",
    color: "bg-emerald-500",
    icon: "🧮",
    status: "সম্পন্ন",
  },
  {
    id: 4,
    title: "বাংলাদেশ ও আন্তর্জাতিক বিষয়াবলি",
    category: "সাধারণ জ্ঞান",
    instructor: "শিক্ষাসেতু একাডেমি",
    progress: 20,
    lessons: "৮ / ৪০",
    duration: "১৮ ঘণ্টা",
    color: "bg-orange-500",
    icon: "🌍",
    status: "চলমান",
  },
];

export default function MyCoursesPage() {
  const [activeTab, setActiveTab] = useState("সব কোর্স");
  const [search, setSearch] = useState("");

  const filteredCourses = courses.filter((course) => {
    const matchesTab =
      activeTab === "সব কোর্স" ||
      (activeTab === "চলমান" && course.status === "চলমান") ||
      (activeTab === "সম্পন্ন" && course.status === "সম্পন্ন");

    const matchesSearch = course.title
      .toLowerCase()
      .includes(search.toLowerCase());

    return matchesTab && matchesSearch;
  });

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-gray-500 transition hover:text-[#3157d5]"
        >
          <span>←</span> ড্যাশবোর্ডে ফিরে যাও
        </Link>

        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="mb-2 text-sm font-semibold text-[#3157d5]">
              LEARNING CENTER
            </p>
            <h1 className="text-3xl font-extrabold text-gray-900">
              আমার কোর্সসমূহ
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              তোমার শেখার অগ্রগতি দেখো এবং পড়াশোনা চালিয়ে যাও।
            </p>
          </div>

          <Link
            href="/courses"
            className="inline-flex items-center justify-center rounded-xl bg-[#3157d5] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#2546b5]"
          >
            + নতুন কোর্স খুঁজুন
          </Link>
        </div>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "মোট কোর্স", value: "০৪", icon: "📘" },
            { label: "চলমান কোর্স", value: "০৩", icon: "📖" },
            { label: "সম্পন্ন কোর্স", value: "০১", icon: "🎓" },
            { label: "মোট শেখার সময়", value: "৫৫ ঘণ্টা", icon: "⏱️" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-gray-500">{item.label}</span>
                <span className="text-2xl">{item.icon}</span>
              </div>
              <p className="text-2xl font-extrabold text-gray-900">
                {item.value}
              </p>
            </div>
          ))}
        </section>

        <section className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-[#2447b8] to-[#4775e8] p-6 text-white sm:p-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <p className="mb-2 text-sm font-semibold text-blue-100">
                KEEP LEARNING
              </p>
              <h2 className="text-2xl font-extrabold">
                শেখা চালিয়ে যাও, এগিয়ে যাও!
              </h2>
              <p className="mt-2 text-sm text-blue-100">
                প্রতিদিন অল্প অল্প পড়াশোনাই তোমাকে লক্ষ্যে পৌঁছে দেবে।
              </p>
            </div>
            <Link
              href="/courses"
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#3157d5] transition hover:bg-blue-50"
            >
              কোর্স দেখুন →
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">
                তোমার শেখার তালিকা
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                কোর্সের অগ্রগতি ও বিস্তারিত দেখো।
              </p>
            </div>

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="কোর্স খুঁজুন..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#3157d5] focus:ring-2 focus:ring-blue-100 sm:w-64"
            />
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {["সব কোর্স", "চলমান", "সম্পন্ন"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${
                  activeTab === tab
                    ? "bg-[#3157d5] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {filteredCourses.map((course) => (
              <article
                key={course.id}
                className="rounded-2xl border border-gray-100 p-5 transition hover:border-blue-200 hover:shadow-md"
              >
                <div className="mb-4 flex items-start gap-4">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${course.color} text-2xl text-white`}
                  >
                    {course.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-[#3157d5]">
                      {course.category}
                    </span>
                    <h3 className="mt-1 text-base font-extrabold text-gray-900">
                      {course.title}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">
                      {course.instructor}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                      course.status === "সম্পন্ন"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {course.status}
                  </span>
                </div>

                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-semibold text-gray-600">
                    কোর্সের অগ্রগতি
                  </span>
                  <span className="font-extrabold text-gray-900">
                    {course.progress}%
                  </span>
                </div>

                <div className="mb-4 h-2.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full ${course.color} transition-all`}
                    style={{ width: `${course.progress}%` }}
                  />
                </div>

                <div className="mb-5 flex flex-wrap gap-4 text-xs text-gray-500">
                  <span>📑 {course.lessons} লেসন</span>
                  <span>⏱️ {course.duration}</span>
                </div>

                <Link
                  href="/courses"
                  className="flex w-full items-center justify-center rounded-xl border border-[#3157d5] px-4 py-3 text-sm font-bold text-[#3157d5] transition hover:bg-[#3157d5] hover:text-white"
                >
                  {course.status === "সম্পন্ন"
                    ? "কোর্সটি আবার দেখুন →"
                    : "শেখা চালিয়ে যান →"}
                </Link>
              </article>
            ))}
          </div>

          {filteredCourses.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-4xl">🔎</p>
              <p className="mt-3 font-bold text-gray-700">
                কোনো কোর্স পাওয়া যায়নি।
              </p>
              <p className="mt-1 text-sm text-gray-500">
                অন্য নামে খুঁজে দেখো অথবা অন্য ক্যাটাগরি নির্বাচন করো।
              </p>
            </div>
          )}
        </section>

        <p className="mt-5 text-center text-xs text-gray-400">
          * এখানে প্রদর্শিত কোর্স ও অগ্রগতির তথ্য আপাতত ডেমো।
        </p>
      </div>
    </main>
  );
}
