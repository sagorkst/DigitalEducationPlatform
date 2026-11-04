
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const questions = [
  { id: 1, question: "বাংলাদেশের জাতীয় ফুল কোনটি?", options: ["গোলাপ", "শাপলা", "বেলি", "জবা"], answer: 1 },
  { id: 2, question: "বাংলা ভাষার আদি নিদর্শন কোনটি?", options: ["শ্রীকৃষ্ণকীর্তন", "চর্যাপদ", "মঙ্গলকাব্য", "বৈষ্ণব পদাবলি"], answer: 1 },
  { id: 3, question: "বাংলাদেশের স্বাধীনতা দিবস কবে?", options: ["১৬ ডিসেম্বর", "২১ ফেব্রুয়ারি", "২৬ মার্চ", "৭ মার্চ"], answer: 2 },
  { id: 4, question: "পদ্মা সেতু কোন নদীর ওপর নির্মিত?", options: ["যমুনা", "মেঘনা", "কর্ণফুলী", "পদ্মা"], answer: 3 },
  { id: 5, question: "জাতিসংঘ প্রতিষ্ঠিত হয় কত সালে?", options: ["১৯৪২", "১৯৪৫", "১৯৪৭", "১৯৫০"], answer: 1 },
  { id: 6, question: "কম্পিউটারের মস্তিষ্ক বলা হয় কোনটিকে?", options: ["RAM", "Hard Disk", "CPU", "Monitor"], answer: 2 },
  { id: 7, question: "১ কিলোবাইট সমান কত বাইট?", options: ["১০০", "৫১২", "১০০০", "১০২৪"], answer: 3 },
  { id: 8, question: "বাংলাদেশের জাতীয় সংসদের সাধারণ আসন সংখ্যা কত?", options: ["২৫০", "৩০০", "৩৫০", "৪০০"], answer: 1 },
  { id: 9, question: "সৌরজগতের বৃহত্তম গ্রহ কোনটি?", options: ["পৃথিবী", "মঙ্গল", "শনি", "বৃহস্পতি"], answer: 3 },
  { id: 10, question: "ইংরেজি ভাষায় Noun বলতে কী বোঝায়?", options: ["কাজ", "নাম", "গুণ", "অবস্থা"], answer: 1 },
];

const TOTAL_TIME = 10 * 60;

export default function OnlineExamPage() {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [submitted, setSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (submitted) return;
    const timer = setInterval(() => {
      setTimeLeft((previous) => {
        if (previous <= 1) {
          clearInterval(timer);
          setSubmitted(true);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [submitted]);

  const question = questions[current];
  const answeredCount = Object.keys(answers).length;
  const unansweredCount = questions.length - answeredCount;
  const correctCount = questions.filter((item) => answers[item.id] === item.answer).length;
  const wrongCount = answeredCount - correctCount;
  const percentage = Math.round((correctCount / questions.length) * 100);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  };

  const selectAnswer = (index: number) => {
    setAnswers((previous) => ({ ...previous, [question.id]: index }));
  };

  const finishExam = () => {
    setShowConfirm(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#f5f7fb] px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border bg-white p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl">🏆</div>
          <h1 className="mt-5 text-3xl font-bold text-slate-900">পরীক্ষা সম্পন্ন!</h1>
          <p className="mt-2 text-slate-500">তোমার পরীক্ষার ফলাফল</p>
          <div className="mt-8 rounded-2xl bg-blue-50 p-7">
            <p className="text-sm text-blue-700">তোমার স্কোর</p>
            <p className="mt-2 text-5xl font-bold text-blue-700">{correctCount}/{questions.length}</p>
            <p className="mt-2 text-lg font-semibold text-slate-700">{percentage}% নম্বর</p>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-emerald-50 p-4"><p className="text-2xl font-bold text-emerald-700">{correctCount}</p><p className="text-xs text-slate-600">সঠিক</p></div>
            <div className="rounded-xl bg-red-50 p-4"><p className="text-2xl font-bold text-red-600">{wrongCount}</p><p className="text-xs text-slate-600">ভুল</p></div>
            <div className="rounded-xl bg-amber-50 p-4"><p className="text-2xl font-bold text-amber-700">{unansweredCount}</p><p className="text-xs text-slate-600">উত্তরহীন</p></div>
          </div>
          <p className="mt-6 text-sm text-slate-500">সময় ব্যবহৃত: {formatTime(TOTAL_TIME - timeLeft)}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button onClick={() => window.location.reload()} className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white">আবার পরীক্ষা দাও</button>
            <Link href="/dashboard/exams" className="rounded-xl border px-6 py-3 font-semibold text-slate-700">পরীক্ষার তালিকায় ফিরে যাও</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb]">
      <header className="sticky top-0 z-20 border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div><p className="text-xs font-medium text-blue-600">শিক্ষাসেতু পরীক্ষা</p><h1 className="font-bold text-slate-900">বাংলা মডেল টেস্ট - ০১</h1></div>
          <div className={`rounded-xl px-4 py-2 text-center ${timeLeft <= 60 ? "bg-red-100 text-red-700" : "bg-blue-50 text-blue-700"}`}>
            <p className="text-xs">অবশিষ্ট সময়</p><p className="text-xl font-bold tabular-nums">{formatTime(timeLeft)}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-7 lg:grid-cols-[1fr_310px]">
        <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
            <div><p className="text-sm text-slate-500">প্রশ্ন {current + 1} / {questions.length}</p><h2 className="mt-1 text-lg font-bold text-slate-800">MCQ পরীক্ষা</h2></div>
            <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">প্রতি প্রশ্নে ১ নম্বর</span>
          </div>
          <div className="mt-8">
            <h3 className="text-xl font-semibold leading-relaxed text-slate-900">{current + 1}. {question.question}</h3>
            <div className="mt-6 space-y-3">
              {question.options.map((option, index) => {
                const selected = answers[question.id] === index;
                return (
                  <button key={index} onClick={() => selectAnswer(index)} className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition ${selected ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-slate-50"}`}>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"}`}>{String.fromCharCode(65 + index)}</span>
                    <span className="font-medium">{option}</span>
                    {selected && <span className="ml-auto text-blue-600">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-6">
            <button onClick={() => setCurrent((p) => Math.max(0, p - 1))} disabled={current === 0} className="rounded-xl border px-5 py-3 font-semibold text-slate-700 disabled:opacity-40">← আগের প্রশ্ন</button>
            {current < questions.length - 1 ? (
              <button onClick={() => setCurrent((p) => Math.min(questions.length - 1, p + 1))} className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white">পরের প্রশ্ন →</button>
            ) : (
              <button onClick={() => setShowConfirm(true)} className="rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white">পরীক্ষা জমা দাও</button>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-900">প্রশ্ন নেভিগেশন</h3>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {questions.map((item, index) => (
                <button key={item.id} onClick={() => setCurrent(index)} className={`h-10 rounded-lg text-sm font-bold ${current === index ? "bg-blue-600 text-white" : answers[item.id] !== undefined ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{index + 1}</button>
              ))}
            </div>
            <div className="mt-5 space-y-3 border-t pt-4 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">মোট প্রশ্ন</span><strong>{questions.length}</strong></div>
              <div className="flex justify-between"><span className="text-emerald-700">উত্তর দেওয়া</span><strong>{answeredCount}</strong></div>
              <div className="flex justify-between"><span className="text-amber-700">বাকি</span><strong>{unansweredCount}</strong></div>
            </div>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-900">নির্দেশনা</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>• প্রতিটি প্রশ্নের একটি সঠিক উত্তর রয়েছে।</p>
              <p>• যেকোনো প্রশ্নে ফিরে গিয়ে উত্তর পরিবর্তন করতে পারবে।</p>
              <p>• সময় শেষ হলে পরীক্ষা স্বয়ংক্রিয়ভাবে জমা হবে।</p>
              <p>• জমা দেওয়ার আগে উত্তরগুলো যাচাই করে নাও।</p>
            </div>
          </div>
          <button onClick={() => setShowConfirm(true)} className="w-full rounded-xl bg-emerald-600 px-5 py-4 font-bold text-white">পরীক্ষা জমা দাও</button>
        </aside>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">পরীক্ষা জমা দিতে চাও?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">উত্তর দেওয়া হয়েছে {answeredCount}টি প্রশ্নে। এখনো {unansweredCount}টি প্রশ্নের উত্তর বাকি। জমা দেওয়ার পর আর উত্তর পরিবর্তন করা যাবে না।</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 rounded-xl border px-4 py-3 font-semibold text-slate-700">ফিরে যাও</button>
              <button onClick={finishExam} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white">হ্যাঁ, জমা দাও</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
