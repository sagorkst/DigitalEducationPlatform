"use client";

import { useState } from "react";
import Link from "next/link";

const chapters = [
  {
    title: "অধ্যায় ১: প্রাথমিক আলোচনা",
    lessons: [
      { title: "কোর্স পরিচিতি ও নির্দেশনা", duration: "৮ মিনিট" },
      { title: "বিষয়ের মৌলিক ধারণা", duration: "১৫ মিনিট" },
      { title: "গুরুত্বপূর্ণ বিষয়সমূহ", duration: "১২ মিনিট" },
    ],
  },
  {
    title: "অধ্যায় ২: বিস্তারিত আলোচনা",
    lessons: [
      { title: "প্রথম পাঠ", duration: "১৮ মিনিট" },
      { title: "দ্বিতীয় পাঠ", duration: "২০ মিনিট" },
      { title: "অনুশীলন ও উদাহরণ", duration: "১৫ মিনিট" },
    ],
  },
  {
    title: "অধ্যায় ৩: অনুশীলন ও মূল্যায়ন",
    lessons: [
      { title: "প্রশ্ন সমাধান", duration: "২০ মিনিট" },
      { title: "মডেল টেস্ট", duration: "২৫ মিনিট" },
    ],
  },
];

export default function CourseDetailsPage() {
  const [selectedLesson, setSelectedLesson] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<number[]>([]);
  const [expandedChapters, setExpandedChapters] = useState<number[]>([0]);

  const allLessons = chapters.flatMap((chapter) => chapter.lessons);
  const currentLesson = allLessons[selectedLesson];
  const progress = Math.round(
    (completedLessons.length / allLessons.length) * 100
  );

  function toggleComplete() {
    setCompletedLessons((previous) =>
      previous.includes(selectedLesson)
        ? previous.filter((item) => item !== selectedLesson)
        : [...previous, selectedLesson]
    );
  }

  function toggleChapter(index: number) {
    setExpandedChapters((previous) =>
      previous.includes(index)
        ? previous.filter((item) => item !== index)
        : [...previous, index]
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/dashboard/courses"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#3157d5]"
        >
          ← আমার কোর্সে ফিরে যাও
        </Link>

        <section className="mb-7 rounded-2xl bg-gradient-to-r from-[#2447b8] to-[#4775e8] p-6 text-white sm:p-8">
          <span className="text-sm font-semibold text-blue-100">
            LEARNING CENTER
          </span>
          <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">
            বাংলা ব্যাকরণ ও সাহিত্য
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100">
            চাকরির পরীক্ষার প্রস্তুতির জন্য বাংলা ব্যাকরণ ও সাহিত্যের
            গুরুত্বপূর্ণ বিষয়গুলো ধারাবাহিকভাবে শিখে নাও।
          </p>

          <div className="mt-6 max-w-xl">
            <div className="mb-2 flex justify-between text-sm">
              <span>তোমার কোর্স অগ্রগতি</span>
              <strong>{progress}%</strong>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-blue-100">
              {completedLessons.length} / {allLessons.length} টি লেসন সম্পন্ন
            </p>
          </div>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="flex aspect-video flex-col items-center justify-center bg-gray-900 px-5 text-center text-white">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/15 text-3xl">
                  ▶
                </div>
                <h2 className="text-lg font-bold">{currentLesson.title}</h2>
                <p className="mt-2 text-sm text-gray-300">
                  ভিডিও লেসনের জায়গা
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  প্রকৃত ভিডিও পরে যুক্ত করা হবে
                </p>
              </div>

              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-[#3157d5]">
                      CURRENT LESSON
                    </p>
                    <h2 className="mt-1 text-lg font-extrabold text-gray-900">
                      {currentLesson.title}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      সময়: {currentLesson.duration}
                    </p>
                  </div>

                  <button
                    onClick={toggleComplete}
                    className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
                      completedLessons.includes(selectedLesson)
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-[#3157d5] text-white hover:bg-[#2546b5]"
                    }`}
                  >
                    {completedLessons.includes(selectedLesson)
                      ? "✓ সম্পন্ন হয়েছে"
                      : "✓ লেসন সম্পন্ন করুন"}
                  </button>
                </div>

                <div className="my-6 border-t border-gray-100" />

                <div>
                  <h3 className="font-extrabold text-gray-900">
                    এই লেসন সম্পর্কে
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-gray-600">
                    এই পাঠে আলোচ্য বিষয়ের গুরুত্বপূর্ণ ধারণা, প্রয়োজনীয়
                    তথ্য এবং পরীক্ষায় কাজে লাগবে এমন বিষয়গুলো শেখানো হবে।
                    পাঠটি মনোযোগ দিয়ে সম্পন্ন করো এবং প্রয়োজনে নোট তৈরি করো।
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap justify-between gap-3">
                  <button
                    disabled={selectedLesson === 0}
                    onClick={() =>
                      setSelectedLesson((value) => Math.max(0, value - 1))
                    }
                    className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ← আগের লেসন
                  </button>
                  <button
                    disabled={selectedLesson === allLessons.length - 1}
                    onClick={() =>
                      setSelectedLesson((value) =>
                        Math.min(allLessons.length - 1, value + 1)
                      )
                    }
                    className="rounded-xl bg-[#3157d5] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#2546b5] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    পরের লেসন →
                  </button>
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-extrabold text-gray-900">
                📎 প্রয়োজনীয় রিসোর্স
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                এই কোর্সের PDF নোট, ক্লাস স্লাইড ও অন্যান্য ফাইল এখানে
                পাওয়া যাবে।
              </p>
              <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-5 text-center">
                <p className="text-2xl">📄</p>
                <p className="mt-2 text-sm font-semibold text-gray-700">
                  এখনো কোনো রিসোর্স যুক্ত করা হয়নি
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  পরে PDF ও প্রয়োজনীয় ফাইল যুক্ত করা যাবে।
                </p>
              </div>
            </section>
          </div>

          <aside className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-extrabold text-gray-900">
                কোর্সের বিষয়বস্তু
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                অধ্যায় ও লেসন নির্বাচন করো
              </p>
            </div>

            <div className="space-y-3">
              {chapters.map((chapter, chapterIndex) => {
                const firstLessonIndex = chapters
                  .slice(0, chapterIndex)
                  .reduce((total, item) => total + item.lessons.length, 0);

                const chapterCompleted = chapter.lessons.filter(
                  (_, lessonIndex) =>
                    completedLessons.includes(firstLessonIndex + lessonIndex)
                ).length;

                return (
                  <div
                    key={chapter.title}
                    className="overflow-hidden rounded-xl border border-gray-100"
                  >
                    <button
                      onClick={() => toggleChapter(chapterIndex)}
                      className="flex w-full items-center justify-between gap-3 bg-gray-50 p-4 text-left transition hover:bg-gray-100"
                    >
                      <span className="text-sm font-bold text-gray-800">
                        {chapter.title}
                      </span>
                      <span className="shrink-0 text-xs text-gray-500">
                        {chapterCompleted}/{chapter.lessons.length}{" "}
                        {expandedChapters.includes(chapterIndex) ? "−" : "+"}
                      </span>
                    </button>

                    {expandedChapters.includes(chapterIndex) && (
                      <div className="p-2">
                        {chapter.lessons.map((lesson, lessonIndex) => {
                          const globalIndex = firstLessonIndex + lessonIndex;
                          const isCompleted =
                            completedLessons.includes(globalIndex);
                          const isSelected = selectedLesson === globalIndex;

                          return (
                            <button
                              key={lesson.title}
                              onClick={() => setSelectedLesson(globalIndex)}
                              className={`mb-1 flex w-full items-start gap-3 rounded-lg p-3 text-left transition last:mb-0 ${
                                isSelected
                                  ? "bg-blue-50 text-[#3157d5]"
                                  : "text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              <span className="mt-0.5 shrink-0">
                                {isCompleted ? "✓" : isSelected ? "▶" : "○"}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold leading-5">
                                  {lesson.title}
                                </span>
                                <span className="mt-1 block text-xs text-gray-400">
                                  {lesson.duration}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 rounded-xl bg-blue-50 p-4">
              <p className="text-sm font-bold text-[#3157d5]">
                💡 পড়াশোনার পরামর্শ
              </p>
              <p className="mt-2 text-xs leading-6 text-gray-600">
                প্রতিটি লেসন শেষ করার পর সেটিকে সম্পন্ন হিসেবে চিহ্নিত
                করো। এতে তোমার শেখার অগ্রগতি সহজে বুঝতে পারবে।
              </p>
            </div>
          </aside>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          * এই পেজের ভিডিও, রিসোর্স ও অগ্রগতির তথ্য আপাতত ডেমো। ডেটাবেজ
          সংযুক্ত হলে তথ্য স্থায়ীভাবে সংরক্ষিত হবে।
        </p>
      </div>
    </main>
  );
}