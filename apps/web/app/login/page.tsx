"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LoginApiResponse = {
  success: boolean;
  message?: string;
  data?: {
    user?: {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      status: string;
    };
  };
};

export default function LoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier,
          password,
        }),
      });

      const result = (await response.json()) as LoginApiResponse;

      if (!response.ok || !result.success) {
        setError(result.message ?? "লগইন করা যায়নি। আবার চেষ্টা করুন।");
        return;
      }

      window.dispatchEvent(new Event("shikhasetu:auth-changed"));

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("সার্ভারের সঙ্গে সংযোগ করা যাচ্ছে না। আবার চেষ্টা করুন।");
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
              YOUR LEARNING JOURNEY
            </p>

            <h1 className="mt-5 text-4xl font-black leading-tight">
              জ্ঞান অর্জন করুন,
              <span className="block text-blue-300">
                লক্ষ্যে পৌঁছে যান।
              </span>
            </h1>

            <p className="mt-6 leading-8 text-slate-300">
              শিক্ষা, দক্ষতা ও ক্যারিয়ার উন্নয়নের প্রতিটি ধাপে শিক্ষাসেতু
              থাকুক আপনার পাশে।
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

            <div className="mt-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
                🔐
              </div>

              <h2 className="mt-6 text-3xl font-black text-slate-900">
                স্বাগতম!
              </h2>

              <p className="mt-2 leading-7 text-slate-500">
                আপনার অ্যাকাউন্টে লগইন করে শেখা চালিয়ে যান।
              </p>
            </div>

            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              <div>
                <label
                  htmlFor="identifier"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  ইমেইল অথবা মোবাইল নম্বর
                </label>

                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="আপনার ইমেইল বা মোবাইল নম্বর"
                  autoComplete="username"
                  required
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  পাসওয়ার্ড
                </label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="আপনার পাসওয়ার্ড লিখুন"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-700 px-5 py-3.5 font-bold text-white shadow-lg shadow-blue-700/20 transition hover:-translate-y-0.5 hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {loading ? "লগইন হচ্ছে..." : "লগইন করুন →"}
              </button>
            </form>

            <div className="my-7 flex items-center gap-4">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-400">
                নতুন ব্যবহারকারী?
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <a
              href="/register"
              className="block w-full rounded-xl border border-blue-200 px-5 py-3.5 text-center font-bold text-blue-700 transition hover:bg-blue-50"
            >
              নতুন অ্যাকাউন্ট তৈরি করুন
            </a>

            <p className="mt-8 text-center text-xs text-slate-400">
              শিক্ষাসেতু — শিক্ষা ও ক্যারিয়ারের বিশ্বস্ত সঙ্গী
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
