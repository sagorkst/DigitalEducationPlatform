"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const exams = [
  {
    id: 1,
    title: "বাংলা মডেল টেস্ট - ০১",
    category: "বাংলা",
    date: "০৫ নভেম্বর ২০২৬",
    duration: "৩০ মিনিট",
    questions: 30,
    status: "upcoming",
    type: "মডেল টেস্ট",
  },
  {
    id: 2,
    title: "English Grammar Test",
    category: "ইংরেজি",
    date: "০৮ নভেম্বর ২০২৬",
    duration: "৪০ মিনিট",
    questions: 40,
    status: "upcoming",
    type: "বিষয়ভিত্তিক",
  },
  {
    id: 3,
    title: "সাধারণ গণিত পরীক্ষা",
    category: "গণিত",
    date: "০১ নভেম্বর ২০২৬",
    duration: "৩০ মিনিট",
    questions: 30,
    status: "completed",
    type: "বিষয়ভিত্তিক",
    score: 24,
    correct: 24,
    wrong: 4,
    skipped: 2,
    total: 30,
  },
  {
    id: 4,
    title: "বাংলাদেশ বিষয়াবলি মডেল টেস্ট",
    category: "সাধারণ জ্ঞান",
    date: "২৯ অক্টোবর ২০২৬",
    duration: "৩০ মিনিট",
    questions: 30,
    status: "completed",
    type: "মডেল টেস্ট",
    score: 21,
    correct: 21,
    wrong: 6,
    skipped: 3,
    total: 30,
  },
  {
    id: 5,
    title: "English Vocabulary Test",
    category: "ইংরেজি",
    date: "২৫ অক্টোবর ২০২৬",
    duration: "২০ মিনিট",
    questions: 20,
    status: "completed",
    type: "বিষয়ভিত্তিক",
    score: 16,
    correct: 16,
    wrong: 3,
    skipped: 1,
    total: 20,
  },
];

export default function MyExamsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedExam, setSelectedExam] = useState<number | null>(null);

  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "upcoming" && exam.status === "upcoming") ||
        (activeTab === "completed" && exam.status === "completed");

      const matchesSearch =
        exam.title.toLowerCase().includes(search.toLowerCase()) ||
        exam.category.toLowerCase().includes(search.toLowerCase());

      return matchesTab && matchesSearch;
    });
  }, [activeTab, search]);

  const completed = exams.filter((exam) => exam.status === "completed");
  const average = Math.round(
    completed.reduce(
      (sum, exam) => sum + (exam.score! / exam.total!) * 100,
      0
    ) / (completed.length || 1)
  );

  const selected = exams.find((exam) => exam.id === selectedExam);

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="mb-3 inline-block text-sm font-semibold text-gray-500 hover:text-[#3157d5]"
            >
              ← ড্যাশবোর্ডে ফিরে যাও
            </Link>
            <h1 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
              আমার পরীক্ষা
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              তোমার পরীক্ষা, ফলাফল ও প্রস্তুতির অগ্রগতি এক জায়গায় দেখো।
            </p>
          </div>
          <Link
            href="/exams"
            className="rounded-xl bg-[#3157d5] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#2546b5]"
          >
            নতুন পরীক্ষা খুঁজুন →
          </Link>
        </div>

        <section className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "মোট পরীক্ষা", value: "২৪", icon: "📝", color: "blue" },
            { label: "সম্পন্ন পরীক্ষা", value: "১৮", icon: "✓", color: "green" },
            { label: "গড় নম্বর", value: `${average}%`, icon: "📊", color: "purple" },
            { label: "অপেক্ষমাণ পরীক্ষা", value: "০৬", icon: "⏳", color: "orange" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">
                  {item.label}
                </p>
                <span className="text-xl">{item.icon}</span>
              </div>
              <p className="mt-3 text-3xl font-extrabold text-gray-900">
                {item.value}
              </p>
            </div>
          ))}
        </section>

        <section className="mb-7 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-2xl bg-gradient-to-r from-[#2447b8] to-[#4775e8] p-6 text-white">
            <p className="text-sm font-semibold text-blue-100">
              YOUR EXAM PERFORMANCE
            </p>
            <h2 className="mt-3 text-2xl font-extrabold">
              তোমার প্রস্তুতি এগিয়ে যাচ্ছে!
            </h2>
            <p className="mt-2 text-sm leading-7 text-blue-100">
              নিয়মিত পরীক্ষা দাও, ভুলগুলো বিশ্লেষণ করো এবং দুর্বল বিষয়গুলোতে
              বেশি অনুশীলন করো।
            </p>
            <div className="mt-6 flex items-end gap-3">
              <span className="text-4xl font-extrabold">{average}%</span>
              <span className="pb-1 text-sm text-blue-100">গড় পরীক্ষার স্কোর</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: `${average}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-extrabold text-gray-900">
              সর্বশেষ পরীক্ষার ফলাফল
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              সাম্প্রতিক সম্পন্ন পরীক্ষার সারসংক্ষেপ
            </p>
            {completed.length > 0 && (
              <>
                <div className="mt-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-800">
                      {completed[0].title}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {completed[0].date}
                    </p>
                  </div>
                  <span className="text-2xl font-extrabold text-emerald-600">
                    {Math.round(
                      (completed[0].score! / completed[0].total!) * 100
                    )}%
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-emerald-50 p-3">
                    <p className="text-xl font-extrabold text-emerald-700">
                      {completed[0].correct}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">সঠিক</p>
                  </div>
                  <div className="rounded-xl bg-red-50 p-3">
                    <p className="text-xl font-extrabold text-red-600">
                      {completed[0].wrong}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">ভুল</p>
                  </div>
                  <div className="rounded-xl bg-gray-100 p-3">
                    <p className="text-xl font-extrabold text-gray-700">
                      {completed[0].skipped}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">উত্তরহীন</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">
                পরীক্ষার তালিকা
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                তোমার সকল পরীক্ষা ও পরীক্ষার ইতিহাস
              </p>
            </div>
            <div className="w-full sm:w-64">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="পরীক্ষা খুঁজুন..."
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#3157d5] focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {[
              { id: "all", label: "সব পরীক্ষা" },
              { id: "upcoming", label: "আসন্ন পরীক্ষা" },
              { id: "completed", label: "সম্পন্ন পরীক্ষা" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                  activeTab === tab.id
                    ? "bg-[#3157d5] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredExams.map((exam) => (
              <div
                key={exam.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-gray-100 p-4 transition hover:border-blue-200 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xl">
                    📝
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900">{exam.title}</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      {exam.category} · {exam.type}
                    </p>
                    <p className="mt-2 text-xs text-gray-400">
                      {exam.date} · {exam.duration} · {exam.questions}টি প্রশ্ন
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  {exam.status === "upcoming" ? (
                    <>
                      <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-600">
                        আসন্ন
                      </span>
                      <button
                        onClick={() => setSelectedExam(exam.id)}
                        className="rounded-lg bg-[#3157d5] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#2546b5]"
                      >
                        বিস্তারিত
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-extrabold text-emerald-600">
                        {exam.score}/{exam.total}
                      </span>
                      <button
                        onClick={() => setSelectedExam(exam.id)}
                        className="rounded-lg border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50"
                      >
                        ফলাফল দেখুন
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {filteredExams.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-3xl">🔍</p>
                <p className="mt-3 font-bold text-gray-700">
                  কোনো পরীক্ষা পাওয়া যায়নি
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  অন্য নামে অনুসন্ধান করে দেখো।
                </p>
              </div>
            )}
          </div>
        </section>

        {selected && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setSelectedExam(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="exam-dialog-title"
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-[#3157d5]">
                    EXAM DETAILS
                  </p>
                  <h2
                    id="exam-dialog-title"
                    className="mt-2 text-xl font-extrabold text-gray-900"
                  >
                    {selected.title}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedExam(null)}
                  className="rounded-lg bg-gray-100 px-3 py-2 text-gray-600 hover:bg-gray-200"
                  aria-label="বন্ধ করুন"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 rounded-xl bg-gray-50 p-4">
                {selected.status === "completed" ? (
                  <>
                    <p className="text-center text-sm text-gray-500">
                      প্রাপ্ত নম্বর
                    </p>
                    <p className="mt-1 text-center text-4xl font-extrabold text-[#3157d5]">
                      {selected.score}/{selected.total}
                    </p>
                    <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="font-extrabold text-emerald-600">
                          {selected.correct}
                        </p>
                        <p className="text-xs text-gray-500">সঠিক</p>
                      </div>
                      <div>
                        <p className="font-extrabold text-red-500">
                          {selected.wrong}
                        </p>
                        <p className="text-xs text-gray-500">ভুল</p>
                      </div>
                      <div>
                        <p className="font-extrabold text-gray-600">
                          {selected.skipped}
                        </p>
                        <p className="text-xs text-gray-500">উত্তরহীন</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-gray-800">
                      পরীক্ষার সময়সূচি
                    </p>
                    <p className="mt-2 text-sm text-gray-600">
                      তারিখ: {selected.date}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      সময়: {selected.duration}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      প্রশ্ন: {selected.questions}টি
                    </p>
                    <p className="mt-4 rounded-lg bg-orange-50 p-3 text-xs leading-6 text-orange-700">
                      এই পরীক্ষার অংশগ্রহণ ব্যবস্থা এখনো চালু হয়নি। পরে
                      অনলাইন পরীক্ষা মডিউলের সঙ্গে যুক্ত হবে।
                    </p>
                  </>
                )}
              </div>

              <button
                onClick={() => setSelectedExam(null)}
                className="mt-5 w-full rounded-xl bg-[#3157d5] py-3 text-sm font-bold text-white hover:bg-[#2546b5]"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-gray-400">
          * পরীক্ষার তথ্য ও ফলাফল আপাতত ডেমো। Database ও Exam Engine যুক্ত
          হলে প্রকৃত তথ্য দেখানো হবে।
        </p>
      </div>
    </main>
  );
}