"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterVerifyPage() {
  const router = useRouter();

  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const savedToken = sessionStorage.getItem(
      "shikhasetu_registration_token",
    );
    const savedEmail = sessionStorage.getItem(
      "shikhasetu_registration_email",
    );

    if (!savedToken) {
      router.replace("/register");
      return;
    }

    setToken(savedToken);
    setEmail(savedEmail ?? "");
    setReady(true);
  }, [router]);

  useEffect(() => {
    if (countdown <= 0) return;

    const timer = window.setInterval(() => {
      setCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [countdown]);

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!/^\d{6}$/.test(code)) {
      setError("সঠিক ৬ সংখ্যার OTP লিখুন।");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, code }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "ইমেইল যাচাই করা যায়নি।");
      }

      sessionStorage.removeItem("shikhasetu_registration_token");
      sessionStorage.removeItem("shikhasetu_registration_email");

      setSuccess(true);

      window.setTimeout(() => {
        router.replace("/login");
      }, 1800);
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

  async function handleResend() {
    setError("");
    setResending(true);

    try {
      const response = await fetch(
        "/api/auth/register/resend-verification",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "নতুন OTP পাঠানো যায়নি।");
      }

      setCountdown(60);
      setCode("");
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "নতুন OTP পাঠানো যায়নি। আবার চেষ্টা করুন।",
      );
    } finally {
      setResending(false);
    }
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fc] px-5">
        <p className="text-sm font-medium text-slate-600">
          যাচাইয়ের পৃষ্ঠা প্রস্তুত হচ্ছে...
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fc] px-5 py-12">
      <div className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-xl sm:p-12">
        <a href="/" className="text-sm font-semibold text-blue-700 hover:text-blue-900">
          ← হোম পেজে ফিরে যান
        </a>

        <div className="mt-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
          ✉️
        </div>

        {success ? (
          <div className="mt-6">
            <h1 className="text-3xl font-black text-green-700">
              ইমেইল যাচাই সফল হয়েছে!
            </h1>
            <p className="mt-3 leading-7 text-slate-600">
              আপনার অ্যাকাউন্ট সক্রিয় হয়েছে। এখন Login পৃষ্ঠায় নেওয়া হচ্ছে।
            </p>
            <a
              href="/login"
              className="mt-7 inline-flex rounded-xl bg-blue-700 px-6 py-3 font-bold text-white hover:bg-blue-800"
            >
              লগইন করুন →
            </a>
          </div>
        ) : (
          <>
            <h1 className="mt-6 text-3xl font-black text-slate-900">
              ইমেইল যাচাই করুন
            </h1>

            <p className="mt-3 leading-7 text-slate-600">
              আপনার ইমেইল ঠিকানায় পাঠানো ৬ সংখ্যার OTP কোডটি লিখুন।
            </p>

            {email && (
              <p className="mt-2 break-all text-sm font-bold text-blue-700">
                {email}
              </p>
            )}

            <form onSubmit={handleVerify} className="mt-7 space-y-5">
              <div>
                <label htmlFor="otp" className="mb-2 block text-sm font-bold text-slate-700">
                  ৬ সংখ্যার OTP কোড
                </label>
                <input
                  id="otp"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-2xl font-bold tracking-[0.5em] outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {error && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full rounded-xl bg-blue-700 px-5 py-3.5 font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "যাচাই হচ্ছে..." : "ইমেইল যাচাই করুন →"}
              </button>
            </form>

            <div className="mt-6 border-t border-slate-100 pt-5 text-center">
              <p className="text-sm text-slate-600">
                OTP পাননি?
              </p>

              {countdown > 0 ? (
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  আবার OTP পাঠাতে অপেক্ষা করুন {countdown} সেকেন্ড
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="mt-2 font-bold text-blue-700 hover:text-blue-900 disabled:opacity-60"
                >
                  {resending ? "OTP পাঠানো হচ্ছে..." : "আবার OTP পাঠান"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
