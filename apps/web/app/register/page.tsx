"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const accountType = String(formData.get("accountType") ?? "");
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    const acceptedTerms = formData.get("terms") === "on";

    if (password !== confirmPassword) {
      setError("দুটি পাসওয়ার্ড মিলছে না।");
      return;
    }

    if (!acceptedTerms) {
      setError("Terms & Conditions এবং Privacy Policy গ্রহণ করতে হবে।");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          accountType,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "অ্যাকাউন্ট তৈরি করা যায়নি।");
      }

      const registrationToken = result.data?.registrationToken;

      if (!registrationToken) {
        throw new Error("Registration token পাওয়া যায়নি। আবার চেষ্টা করুন।");
      }

      sessionStorage.setItem(
        "shikhasetu_registration_token",
        registrationToken,
      );

      sessionStorage.setItem("shikhasetu_registration_email", email);

      router.push("/register/verify");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "সার্ভারের সঙ্গে যোগাযোগ করা যায়নি।",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fc] px-5 py-12">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl lg:grid-cols-2">
        <section className="hidden flex-col justify-between bg-[#101d3a] p-12 text-white lg:flex">
          <a href="/" className="text-2xl font-black">
            🎓 শিক্ষাসেতু
          </a>

          <div>
            <p className="text-sm font-bold tracking-widest text-blue-300">
              JOIN OUR COMMUNITY
            </p>
            <h1 className="mt-5 text-4xl font-black leading-tight">
              আপনার সম্ভাবনাকে
              <span className="block text-blue-300">বাস্তবে রূপ দিন।</span>
            </h1>
            <p className="mt-6 leading-8 text-slate-300">
              একটি অ্যাকাউন্টের মাধ্যমে শিক্ষা, চাকরির প্রস্তুতি,
              দক্ষতা উন্নয়ন ও অনলাইন কোর্সের সুযোগ গ্রহণ করুন।
            </p>
          </div>

          <p className="text-sm text-slate-400">
            © 2026 শিক্ষাসেতু। সর্বস্বত্ব সংরক্ষিত।
          </p>
        </section>

        <section className="flex items-center justify-center p-7 sm:p-12">
          <div className="w-full max-w-md">
            <a
              href="/"
              className="text-sm font-semibold text-blue-700 hover:text-blue-900"
            >
              ← হোম পেজে ফিরে যান
            </a>

            <div className="mt-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
                ✨
              </div>

              <h2 className="mt-5 text-3xl font-black text-slate-900">
                অ্যাকাউন্ট তৈরি করুন
              </h2>
              <p className="mt-2 leading-7 text-slate-500">
                আপনার তথ্য দিয়ে শিক্ষাসেতুতে যুক্ত হোন।
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-bold text-slate-700">
                  পূর্ণ নাম
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="আপনার পূর্ণ নাম লিখুন"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-bold text-slate-700">
                  ইমেইল ঠিকানা
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="example@email.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label htmlFor="phone" className="mb-2 block text-sm font-bold text-slate-700">
                  মোবাইল নম্বর
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  placeholder="01XXXXXXXXX"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label htmlFor="accountType" className="mb-2 block text-sm font-bold text-slate-700">
                  আপনি কোন ধরনের ব্যবহারকারী?
                </label>
                <select
                  id="accountType"
                  name="accountType"
                  required
                  defaultValue=""
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                >
                  <option value="" disabled>অ্যাকাউন্টের ধরন নির্বাচন করুন</option>
                  <option value="GENERAL">সাধারণ</option>
                  <option value="STUDENT">শিক্ষার্থী</option>
                  <option value="JOB_SEEKER">চাকরিপ্রার্থী</option>
                  <option value="TEACHER">শিক্ষক / প্রশিক্ষক</option>
                  <option value="INSTITUTION">শিক্ষাপ্রতিষ্ঠান</option>
                </select>
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-bold text-slate-700">
                  পাসওয়ার্ড
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="একটি শক্তিশালী পাসওয়ার্ড দিন"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mb-2 block text-sm font-bold text-slate-700">
                  পাসওয়ার্ড নিশ্চিত করুন
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="পাসওয়ার্ড আবার লিখুন"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <label className="flex items-start gap-2 pt-1 text-sm leading-6 text-slate-600">
                <input
                  type="checkbox"
                  name="terms"
                  required
                  className="mt-1 h-4 w-4 accent-blue-700"
                />
                <span>
                  আমি <a href="/terms" className="font-semibold text-blue-700">Terms & Conditions</a> এবং
                  <a href="/privacy" className="font-semibold text-blue-700"> Privacy Policy</a> মেনে নিচ্ছি।
                </span>
              </label>

              {error && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-700 px-5 py-3.5 font-bold text-white shadow-lg shadow-blue-700/20 transition hover:-translate-y-0.5 hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "অ্যাকাউন্ট তৈরি হচ্ছে..." : "অ্যাকাউন্ট তৈরি করুন →"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              ইতোমধ্যে অ্যাকাউন্ট আছে?
              <a href="/login" className="ml-1 font-bold text-blue-700 hover:text-blue-900">
                লগইন করুন
              </a>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
