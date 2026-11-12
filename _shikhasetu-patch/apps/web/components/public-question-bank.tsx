"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Item = {
  id: string; questionText: string; questionType: string; subject: string; topic: string;
  difficulty: string; isRepeated: boolean; occurrenceCount: number;
  occurrences: { institution: string; examName: string; examYear: number; postName?: string | null }[];
};
type Options = { institutions: {id:string;name:string}[]; exams:{id:string;name:string;examYear:number}[]; posts:{id:string;name:string}[]; years:number[]; topics:{id:string;name:string;subjectId:string}[] };
type Filters = { search:string; subjectId:string; topicId:string; institution:string; exam:string; post:string; yearFrom:string; yearTo:string; questionType:string; difficulty:string; isRepeated:string };

const normalizeDigits = (value:string) => value.replace(/[০-৯]/g, digit => String("০১২৩৪৫৬৭৮৯".indexOf(digit)));

const initial: Filters = { search:"", subjectId:"", topicId:"", institution:"", exam:"", post:"", yearFrom:"", yearTo:"", questionType:"", difficulty:"", isRepeated:"" };

export default function PublicQuestionBank({ initialSubjectId = "", initialTopicId = "" }: { initialSubjectId?: string; initialTopicId?: string }) {
  const [filters,setFilters] = useState<Filters>({ ...initial, subjectId: initialSubjectId, topicId: initialTopicId });
  const [items,setItems] = useState<Item[]>([]);
  const [options,setOptions] = useState<Options>({institutions:[],exams:[],posts:[],years:[],topics:[]});
  const [subjects,setSubjects] = useState<{id:string;name:string;_count:{questions:number}}[]>([]);
  const [page,setPage] = useState(1);
  const [total,setTotal] = useState(0);
  const [totalPages,setTotalPages] = useState(0);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFilters(old => ({ ...old, subjectId: params.get("subjectId") ?? initialSubjectId, topicId: params.get("topicId") ?? initialTopicId }));
    fetch("/api/public/filters").then(r=>r.json()).then(r=>{if(r.success)setOptions(r.data)}).catch(()=>{});
    fetch("/api/public/subjects").then(r=>r.json()).then(r=>{if(r.success)setSubjects(r.data)}).catch(()=>{});
  }, [initialSubjectId, initialTopicId]);

  const query = useMemo(() => {
    const p = new URLSearchParams({page:String(page),limit:"20"});
    Object.entries(filters).forEach(([k,v])=>{if(v.trim())p.set(k,v.trim())});
    return p.toString();
  },[filters,page]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response=await fetch(`/api/public/questions?${query}`,{cache:"no-store"});
      const result=await response.json();
      if(!response.ok || !result.success) throw new Error(result.message || "প্রশ্ন লোড করা যায়নি।");
      setItems(result.data); setTotal(result.pagination.total); setTotalPages(result.pagination.totalPages);
    } catch(e) { setError(e instanceof Error?e.message:"প্রশ্ন লোড করা যায়নি।"); }
    finally {setLoading(false);}
  },[query]);
  useEffect(()=>{void load()},[load]);

  const update=(key:keyof Filters,value:string)=>{setPage(1);setFilters(old=>({...old,[key]:value,...(key==="subjectId"?{topicId:""}:{})}))};
  const clear=()=>{setFilters(initial);setPage(1)};
  const inputClass="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
  const selectClass=inputClass;

  return <main className="min-h-screen bg-slate-50">
    <section className="bg-[#142B49] text-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
        <p className="mb-2 text-sm font-semibold tracking-wide text-emerald-300">SHIKHASETU · PUBLIC QUESTION BANK</p>
        <h1 className="text-3xl font-extrabold sm:text-4xl">প্রশ্নব্যাংক</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">চাকরি, ভর্তি ও একাডেমিক প্রস্তুতির প্রশ্ন পড়ুন—কোনো লগইন ছাড়াই। বিষয়, অধ্যায়, প্রতিষ্ঠান ও পরীক্ষার ভিত্তিতে প্রশ্ন খুঁজুন।</p>
        <div className="mt-6 max-w-3xl">
          <label htmlFor="q-search" className="mb-2 block text-sm font-semibold">প্রশ্ন খুঁজুন · Search questions</label>
          <input id="q-search" className="w-full rounded-xl border-0 bg-white px-4 py-3.5 text-slate-900 outline-none ring-2 ring-transparent placeholder:text-slate-400 focus:ring-emerald-400" placeholder="বাংলা বা English-এ প্রশ্ন/বিষয় লিখুন..." value={filters.search} onChange={e=>update("search",e.target.value)} />
        </div>
      </div>
    </section>

    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-slate-900">বিষয়সমূহ</h2><span className="text-xs text-slate-500">{subjects.length} বিষয়</span></div>
          <div className="max-h-72 space-y-1 overflow-auto">
            {subjects.map(s=><Link key={s.id} href={`/question-bank/subject/${s.id}`} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${filters.subjectId===s.id?"bg-emerald-50 font-bold text-emerald-800":"text-slate-700 hover:bg-slate-50"}`}><span>{s.name}</span><span className="text-xs text-slate-400">{s._count.questions}</span></Link>)}
            {!subjects.length&&<p className="text-sm text-slate-500">এখনো কোনো প্রকাশিত বিষয় নেই।</p>}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-slate-900">ফিল্টার</h2><button onClick={clear} className="text-xs font-semibold text-emerald-700 hover:underline">সব মুছুন</button></div>
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-600">টপিক / অধ্যায়<select className={`${selectClass} mt-1`} value={filters.topicId} onChange={e=>update("topicId",e.target.value)}><option value="">সব টপিক</option>{options.topics.filter(x=>!filters.subjectId||x.subjectId===filters.subjectId).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>{filters.topicId&&<Link href={`/question-bank/topic/${filters.topicId}`} className="mt-1 inline-block text-xs font-bold text-emerald-700 hover:underline">এই টপিকের সব প্রশ্ন দেখুন →</Link>}</label>
            <label className="block text-xs font-semibold text-slate-600">প্রতিষ্ঠান<select className={`${selectClass} mt-1`} value={filters.institution} onChange={e=>update("institution",e.target.value)}><option value="">সব প্রতিষ্ঠান</option>{options.institutions.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-600">পরীক্ষা<select className={`${selectClass} mt-1`} value={filters.exam} onChange={e=>update("exam",e.target.value)}><option value="">সব পরীক্ষা</option>{options.exams.map(x=><option key={x.id} value={x.name}>{x.name} ({x.examYear})</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-600">পদ<select className={`${selectClass} mt-1`} value={filters.post} onChange={e=>update("post",e.target.value)}><option value="">সব পদ</option>{options.posts.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-600">সাল থেকে<input className={`${inputClass} mt-1`} inputMode="numeric" placeholder="যেমন ২০১৯" value={filters.yearFrom} onChange={e=>update("yearFrom",normalizeDigits(e.target.value).replace(/[^\d]/g,""))}/></label>
            <label className="block text-xs font-semibold text-slate-600">সাল পর্যন্ত<input className={`${inputClass} mt-1`} inputMode="numeric" placeholder="যেমন ২০২৬" value={filters.yearTo} onChange={e=>update("yearTo",normalizeDigits(e.target.value).replace(/[^\d]/g,""))}/></label>
            <label className="block text-xs font-semibold text-slate-600">প্রশ্নের ধরন<select className={`${selectClass} mt-1`} value={filters.questionType} onChange={e=>update("questionType",e.target.value)}><option value="">সব ধরন</option><option value="MCQ">MCQ</option><option value="WRITTEN">Written</option><option value="TRUE_FALSE">True / False</option><option value="FILL_IN_THE_BLANKS">Fill in the blanks</option></select></label>
            <label className="block text-xs font-semibold text-slate-600">কঠিনতার মাত্রা<select className={`${selectClass} mt-1`} value={filters.difficulty} onChange={e=>update("difficulty",e.target.value)}><option value="">সব মাত্রা</option><option value="EASY">সহজ</option><option value="MEDIUM">মাঝারি</option><option value="HARD">কঠিন</option></select></label>
            <label className="block text-xs font-semibold text-slate-600">পুনরাবৃত্ত প্রশ্ন<select className={`${selectClass} mt-1`} value={filters.isRepeated} onChange={e=>update("isRepeated",e.target.value)}><option value="">সব প্রশ্ন</option><option value="true">পুনরাবৃত্ত</option><option value="false">পুনরাবৃত্ত নয়</option></select></label>
          </div>
        </section>
      </aside>

      <section className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-extrabold text-slate-900">প্রকাশিত প্রশ্নসমূহ</h2><p className="text-sm text-slate-500">{total.toLocaleString("bn-BD")}টি প্রশ্ন পাওয়া গেছে</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">সবার জন্য উন্মুক্ত</span></div>
        {loading&&<div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">প্রশ্ন লোড হচ্ছে...</div>}
        {!loading&&error&&<div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>}
        {!loading&&!error&&!items.length&&<div className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><h3 className="font-bold text-slate-800">কোনো প্রশ্ন পাওয়া যায়নি</h3><p className="mt-2 text-sm text-slate-500">অন্য শব্দ বা ফিল্টার দিয়ে চেষ্টা করুন।</p><button onClick={clear} className="mt-4 rounded-lg bg-[#142B49] px-4 py-2 text-sm font-bold text-white">ফিল্টার মুছুন</button></div>}
        <div className="space-y-3">
          {items.map((q,index)=><article key={q.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-md bg-slate-100 px-2 py-1 font-bold text-slate-600">প্রশ্ন {(page-1)*20+index+1}</span><span className="rounded-md bg-blue-50 px-2 py-1 font-semibold text-blue-700">{q.subject}</span>{q.topic&&<span className="rounded-md bg-slate-50 px-2 py-1 text-slate-600">{q.topic}</span>}<span className="rounded-md bg-violet-50 px-2 py-1 font-semibold text-violet-700">{q.questionType}</span><span className="rounded-md bg-slate-50 px-2 py-1 text-slate-600">{q.difficulty}</span>{q.isRepeated&&<span className="rounded-md bg-amber-50 px-2 py-1 font-bold text-amber-700">পুনরাবৃত্ত · {q.occurrenceCount} বার</span>}</div>
            <h3 className="text-base font-semibold leading-8 text-slate-900">{q.questionText}</h3>
            {q.options.length>0&&<div className="mt-3 grid gap-2 sm:grid-cols-2">{q.options.map(o=><div key={o.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"><b className="mr-2 text-slate-500">{o.label}.</b>{o.optionText}</div>)}</div>}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs leading-6 text-slate-500">{q.occurrences.slice(0,2).map(o=>`${o.institution} · ${o.examName} · ${o.examYear}${o.postName?` · ${o.postName}`:""}`).join("  | ")||"পরীক্ষার তথ্য যুক্ত নেই"}</p><Link href={`/question-bank/${q.id}`} className="rounded-lg bg-[#142B49] px-4 py-2 text-sm font-bold text-white hover:bg-[#1d3b60]">প্রশ্ন পড়ুন <span aria-hidden>→</span></Link></div>
          </article>)}
        </div>
        {!loading&&totalPages>1&&<nav aria-label="প্রশ্নের পৃষ্ঠা" className="mt-6 flex flex-wrap items-center justify-center gap-2"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40">আগের</button><span className="px-3 text-sm text-slate-600">পৃষ্ঠা {page.toLocaleString("bn-BD")} / {totalPages.toLocaleString("bn-BD")}</span><button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40">পরের</button></nav>}
      </section>
    </div>
  </main>;
}
