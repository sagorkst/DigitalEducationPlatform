"use client";

import { useEffect, useState } from "react";
import AdminQuestionBank from "./admin-question-bank";

export default function AdminQuestionBankGate() {
  const [state,setState]=useState<"loading"|"allowed"|"denied">("loading");
  useEffect(()=>{
    fetch("/api/auth/me",{cache:"no-store"}).then(async response=>{
      const result=await response.json();
      const permissions:string[]=result?.data?.permissions??[];
      setState(response.ok && permissions.includes("content.manage") ? "allowed":"denied");
    }).catch(()=>setState("denied"));
  },[]);
  if(state==="loading")return <main className="mx-auto max-w-4xl px-4 py-16 text-center text-slate-500">অনুমতি যাচাই হচ্ছে...</main>;
  if(state==="denied")return <main className="mx-auto max-w-4xl px-4 py-16"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center"><h1 className="text-xl font-bold text-slate-900">প্রবেশাধিকার নেই</h1><p className="mt-2 text-sm text-slate-600">প্রশ্নব্যাংক ব্যবস্থাপনা দেখতে অনুমোদিত অ্যাকাউন্ট প্রয়োজন।</p><a href="/question-bank" className="mt-5 inline-block rounded-lg bg-[#142B49] px-4 py-2 text-sm font-bold text-white">Public Question Bank</a></div></main>;
  return <AdminQuestionBank />;
}
