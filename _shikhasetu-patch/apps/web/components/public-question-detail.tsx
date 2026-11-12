"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Detail = {
 id:string; questionText:string; questionType:string; subject:string; topic:string;
 correctAnswer:string|null; explanation:string|null; difficulty:string; isRepeated:boolean; occurrenceCount:number;
 options:{id:string;label:string;optionText:string;isCorrect:boolean}[];
 occurrences:{institution:string;examName:string;examYear:number;postName?:string|null;department?:string|null;source?:string|null;sourcePage?:number|null;sourceUrl?:string|null}[];
 relatedQuestions:{id:string;questionText:string;subject:string;topic:string}[]; previousQuestionId:string|null; nextQuestionId:string|null;
};

export default function PublicQuestionDetail({id}:{id:string}) {
 const [data,setData]=useState<Detail|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [revealed,setRevealed]=useState(false);
 useEffect(()=>{fetch(`/api/public/questions/${encodeURIComponent(id)}`,{cache:"no-store"}).then(async r=>{const x=await r.json();if(!r.ok||!x.success)throw new Error(x.message||"প্রশ্ন পাওয়া যায়নি।");setData(x.data)}).catch(e=>setError(e instanceof Error?e.message:"প্রশ্ন লোড করা যায়নি।")).finally(()=>setLoading(false))},[id]);
 if(loading)return <main className="mx-auto max-w-4xl px-4 py-16 text-center text-slate-500">প্রশ্ন লোড হচ্ছে...</main>;
 if(error||!data)return <main className="mx-auto max-w-4xl px-4 py-16"><div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-xl font-bold text-slate-900">প্রশ্নটি পাওয়া যায়নি</h1><p className="mt-2 text-sm text-slate-500">{error}</p><Link className="mt-5 inline-block rounded-lg bg-[#142B49] px-4 py-2 text-white" href="/question-bank">প্রশ্নব্যাংকে ফিরুন</Link></div></main>;
 return <main className="min-h-screen bg-slate-50"><div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
  <Link href="/question-bank" className="text-sm font-bold text-emerald-700 hover:underline">← প্রশ্নব্যাংকে ফিরুন</Link>
  <article className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
   <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-md bg-blue-50 px-3 py-1 font-bold text-blue-700">{data.subject}</span>{data.topic&&<span className="rounded-md bg-slate-100 px-3 py-1 text-slate-700">{data.topic}</span>}<span className="rounded-md bg-slate-100 px-3 py-1 text-slate-700">{data.questionType}</span>{data.isRepeated&&<span className="rounded-md bg-amber-50 px-3 py-1 font-bold text-amber-700">পুনরাবৃত্ত · {data.occurrenceCount} বার</span>}</div>
   <h1 className="mt-6 text-xl font-extrabold leading-9 text-slate-900 sm:text-2xl">{data.questionText}</h1>
   {data.options.length>0&&<div className="mt-6 grid gap-3 sm:grid-cols-2">{data.options.map(o=><div key={o.id} className={`rounded-xl border p-4 text-sm leading-7 ${revealed&&o.isCorrect?"border-emerald-300 bg-emerald-50 font-semibold text-emerald-900":"border-slate-200 bg-slate-50 text-slate-800"}`}><b className="mr-2">{o.label}.</b>{o.optionText}{revealed&&o.isCorrect&&<span className="ml-2 text-xs font-bold">✓ সঠিক উত্তর</span>}</div>)}</div>}
   <div className="mt-7"><button onClick={()=>setRevealed(v=>!v)} className="rounded-xl bg-[#16A36A] px-5 py-3 text-sm font-extrabold text-white hover:bg-emerald-700">{revealed?"উত্তর লুকান":"উত্তর দেখুন / Show Answer"}</button></div>
   {revealed&&<section aria-live="polite" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h2 className="font-extrabold text-emerald-900">সঠিক উত্তর</h2><p className="mt-2 text-sm leading-7 text-emerald-950">{data.correctAnswer||data.options.find(o=>o.isCorrect)?.label||"ডাটাবেজে উত্তর দেওয়া নেই।"}</p>{data.explanation&&<><h3 className="mt-4 font-bold text-emerald-900">ব্যাখ্যা</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-emerald-950">{data.explanation}</p></>}</section>}
  </article>
  <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-extrabold text-slate-900">পরীক্ষার তথ্য</h2>{data.occurrences.length? <div className="mt-3 space-y-3">{data.occurrences.map((o,i)=><div key={`${o.examName}-${o.examYear}-${i}`} className="rounded-xl bg-slate-50 p-4 text-sm"><p className="font-bold text-slate-900">{o.institution} · {o.examName}</p><p className="mt-1 text-slate-600">সাল: {o.examYear}{o.postName?` · পদ: ${o.postName}`:""}{o.department?` · বিভাগ: ${o.department}`:""}</p>{(o.source||o.sourcePage)&&<p className="mt-1 text-xs text-slate-500">সূত্র: {o.source||"উল্লেখ নেই"}{o.sourcePage?` · পৃষ্ঠা ${o.sourcePage}`:""}</p>}{o.sourceUrl&&<a className="mt-1 inline-block text-xs font-semibold text-blue-700 underline" href={o.sourceUrl} target="_blank" rel="noreferrer">মূল উৎস দেখুন</a>}</div>)}</div>:<p className="mt-2 text-sm text-slate-500">পরীক্ষার তথ্য সংরক্ষিত নেই।</p>}</section>
  <nav aria-label="প্রশ্ন নেভিগেশন" className="mt-5 flex items-center justify-between gap-3"><span>{data.previousQuestionId?<Link href={`/question-bank/${data.previousQuestionId}`} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">← আগের প্রশ্ন</Link>:<span className="text-xs text-slate-400">আগের প্রশ্ন নেই</span>}</span><span>{data.nextQuestionId?<Link href={`/question-bank/${data.nextQuestionId}`} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">পরের প্রশ্ন →</Link>:<span className="text-xs text-slate-400">পরের প্রশ্ন নেই</span>}</span></nav>
  {data.relatedQuestions.length>0&&<section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-extrabold text-slate-900">একই গ্রুপের প্রশ্ন</h2><div className="mt-3 space-y-2">{data.relatedQuestions.map(q=><Link key={q.id} href={`/question-bank/${q.id}`} className="block rounded-xl border border-slate-100 p-3 text-sm font-medium leading-7 text-slate-800 hover:border-emerald-200 hover:bg-emerald-50">{q.questionText}</Link>)}</div></section>}
 </div></main>;
}
