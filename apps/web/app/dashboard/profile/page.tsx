"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";

type UserProfile = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar: string | null;
  status: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  roles: Array<{
    id: string;
    name: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
};

const API_ORIGIN = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000"
).replace(/\/api\/?$/, "");

function getAvatarUrl(avatar: string | null) {
  if (!avatar) return null;

  if (/^https?:\/\//i.test(avatar)) {
    return avatar;
  }

  return `${API_ORIGIN}${avatar.startsWith("/") ? "" : "/"}${avatar}`;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fieldClass =
    "mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-500";

  const labelClass = "text-sm font-semibold text-gray-600";

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/users/me", {
        method: "GET",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.data) {
        if (response.status === 401 || response.status === 403) {
          window.location.assign("/login");
          return;
        }

        throw new Error(result.message || "প্রোফাইল লোড করা যায়নি।");
      }

      const user: UserProfile = result.data;

      setProfile(user);
      setName(user.name || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "প্রোফাইল লোড করতে সমস্যা হয়েছে।",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!previewUrl) return;

    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const avatarUrl = getAvatarUrl(profile?.avatar || null);

  const roleLabel = profile?.roles?.length
    ? profile.roles.map((role) => role.name).join(", ")
    : "সদস্য";

  const completionItems = [
    Boolean(profile?.name),
    Boolean(profile?.email || profile?.phone),
    Boolean(profile?.emailVerified || profile?.phoneVerified),
    Boolean(profile?.avatar),
  ];

  const completion = Math.round(
    (completionItems.filter(Boolean).length / completionItems.length) * 100,
  );

  function startEditing() {
    setName(profile?.name || "");
    setEmail(profile?.email || "");
    setPhone(profile?.phone || "");
    setEditing(true);
    setError("");
    setSuccess("");
  }

  function cancelEditing() {
    setName(profile?.name || "");
    setEmail(profile?.email || "");
    setPhone(profile?.phone || "");
    setEditing(false);
    setError("");
  }

  async function saveProfile() {
    if (!name.trim()) {
      setError("আপনার নাম লিখুন।");
      return;
    }

    if (!email.trim() && !phone.trim()) {
      setError("অন্তত একটি Email অথবা Phone Number প্রয়োজন।");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "প্রোফাইল আপডেট করা যায়নি।");
      }

      await loadProfile();
      setEditing(false);
      setSuccess("আপনার প্রোফাইল সফলভাবে আপডেট হয়েছে।");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "প্রোফাইল আপডেট করতে সমস্যা হয়েছে।",
      );
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file?: File) {
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setError("শুধু JPG, PNG অথবা WebP ছবি আপলোড করতে পারবেন।");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("ছবির সাইজ সর্বোচ্চ ৫ MB হতে পারবে।");
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setUploading(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/users/me/avatar", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "ছবি আপলোড করা যায়নি।");
      }

      const updatedProfile = await fetch("/api/users/me", {
        cache: "no-store",
      });

      const profileResult = await updatedProfile.json();

      if (!updatedProfile.ok || !profileResult.success) {
        throw new Error("ছবি আপলোড হয়েছে, কিন্তু প্রোফাইল রিফ্রেশ করা যায়নি।");
      }

      setProfile(profileResult.data);
      setSuccess("Profile Photo সফলভাবে আপলোড হয়েছে।");
    } catch (err) {
      setPreviewUrl(null);
      setError(
        err instanceof Error
          ? err.message
          : "ছবি আপলোড করতে সমস্যা হয়েছে।",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function removeAvatar() {
    if (!profile?.avatar) return;

    const confirmed = window.confirm(
      "আপনি কি আপনার Profile Photo মুছে ফেলতে চান?",
    );

    if (!confirmed) return;

    setRemoving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/users/me/avatar", {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "ছবি মুছে ফেলা যায়নি।");
      }

      setProfile((current) =>
        current ? { ...current, avatar: null } : current,
      );

      setSuccess("Profile Photo সরানো হয়েছে।");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "ছবি সরাতে সমস্যা হয়েছে।",
      );
    } finally {
      setRemoving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-4">
        <div className="rounded-2xl border border-gray-100 bg-white px-8 py-7 text-center shadow-sm">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
          <p className="mt-4 text-sm font-medium text-gray-600">
            আপনার প্রোফাইল লোড হচ্ছে...
          </p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-7 text-center shadow-sm">
          <p className="font-semibold text-red-600">
            {error || "প্রোফাইল পাওয়া যায়নি।"}
          </p>
          <button
            onClick={() => void loadProfile()}
            className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            আবার চেষ্টা করুন
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              ← ড্যাশবোর্ডে ফিরে যান
            </Link>
            <h1 className="mt-3 text-2xl font-bold text-gray-900 sm:text-3xl">
              আমার প্রোফাইল
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              আপনার ব্যক্তিগত তথ্য ও প্রোফাইল পরিচালনা করুন।
            </p>
          </div>

          {!editing && (
            <button
              onClick={startEditing}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              ✎ প্রোফাইল সম্পাদনা
            </button>
          )}
        </div>

        {(error || success) && (
          <div
            role="alert"
            className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {error || success}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="space-y-6">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
              <div className="relative mx-auto h-28 w-28">
                {previewUrl || avatarUrl ? (
                  <img
                    src={previewUrl || avatarUrl || ""}
                    alt="Profile Photo"
                    className="h-28 w-28 rounded-full border-4 border-blue-50 object-cover"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-blue-100 text-4xl font-bold text-blue-700">
                    {profile.name?.trim().charAt(0)?.toUpperCase() || "U"}
                  </div>
                )}

                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-xs font-semibold text-white">
                    আপলোড হচ্ছে...
                  </div>
                )}
              </div>

              <h2 className="mt-4 text-xl font-bold text-gray-900">
                {profile.name}
              </h2>
              <p className="mt-1 break-all text-sm text-gray-500">
                {profile.email || profile.phone || "যোগাযোগের তথ্য যোগ করুন"}
              </p>

              <span className="mt-4 inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                {roleLabel}
              </span>

              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  disabled={uploading || removing}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploading ? "আপলোড হচ্ছে..." : "ছবি পরিবর্তন"}
                </button>

                {profile.avatar && (
                  <button
                    type="button"
                    disabled={uploading || removing}
                    onClick={() => void removeAvatar()}
                    className="rounded-xl border border-red-200 px-4 py-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {removing ? "সরানো হচ্ছে..." : "ছবি সরান"}
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  void uploadAvatar(event.target.files?.[0]);
                }}
              />

              <p className="mt-3 text-xs text-gray-400">
                JPG, PNG অথবা WebP · সর্বোচ্চ ৫ MB
              </p>

              <div className="mt-6 border-t border-gray-100 pt-5 text-left">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-600">
                    প্রোফাইল সম্পূর্ণতা
                  </span>
                  <span className="font-bold text-blue-600">
                    {completion}%
                  </span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{ width: `${completion}%` }}
                  />
                </div>

                <p className="mt-3 text-xs leading-5 text-gray-500">
                  প্রোফাইল সম্পূর্ণ করতে ছবি ও যোগাযোগের তথ্য যোগ করুন এবং
                  যোগাযোগের তথ্য যাচাই করুন।
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-gray-900">প্রোফাইল মেনু</h3>
              <div className="mt-4 space-y-2 text-sm">
                <Link
                  href="/dashboard/profile"
                  className="block rounded-xl bg-blue-50 px-4 py-3 font-semibold text-blue-700"
                >
                  👤 ব্যক্তিগত তথ্য
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="block rounded-xl px-4 py-3 text-gray-600 hover:bg-gray-50"
                >
                  ⚙️ অ্যাকাউন্ট সেটিংস
                </Link>
                <Link
                  href="/dashboard"
                  className="block rounded-xl px-4 py-3 text-gray-600 hover:bg-gray-50"
                >
                  ▦ ড্যাশবোর্ড
                </Link>
              </div>
            </div>
          </section>

          <section className="lg:col-span-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-7 border-b border-gray-100 pb-5">
                <h2 className="text-lg font-bold text-gray-900">
                  ব্যক্তিগত তথ্য
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  আপনার সঠিক তথ্য দিয়ে প্রোফাইল আপডেট করুন।
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <label className={labelClass}>
                  সম্পূর্ণ নাম
                  <input
                    className={fieldClass}
                    value={editing ? name : profile.name}
                    readOnly={!editing}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={120}
                  />
                </label>

                <label className={labelClass}>
                  ইমেইল ঠিকানা
                  <input
                    type="email"
                    className={fieldClass}
                    value={editing ? email : profile.email || ""}
                    readOnly={!editing}
                    onChange={(event) => setEmail(event.target.value)}
                    maxLength={254}
                  />
                  <span
                    className={`mt-2 block text-xs ${
                      profile.emailVerified ? "text-green-600" : "text-amber-600"
                    }`}
                  >
                    {profile.email
                      ? profile.emailVerified
                        ? "✓ ইমেইল যাচাইকৃত"
                        : "ইমেইল যাচাই করা হয়নি"
                      : "ইমেইল যোগ করা হয়নি"}
                  </span>
                </label>

                <label className={labelClass}>
                  মোবাইল নম্বর
                  <input
                    type="tel"
                    className={fieldClass}
                    value={editing ? phone : profile.phone || ""}
                    readOnly={!editing}
                    onChange={(event) => setPhone(event.target.value)}
                    maxLength={20}
                  />
                  <span
                    className={`mt-2 block text-xs ${
                      profile.phoneVerified ? "text-green-600" : "text-amber-600"
                    }`}
                  >
                    {profile.phone
                      ? profile.phoneVerified
                        ? "✓ মোবাইল নম্বর যাচাইকৃত"
                        : "মোবাইল নম্বর যাচাই করা হয়নি"
                      : "মোবাইল নম্বর যোগ করা হয়নি"}
                  </span>
                </label>

                <label className={labelClass}>
                  অ্যাকাউন্টের ধরন
                  <input
                    className={fieldClass}
                    value={roleLabel}
                    readOnly
                    disabled
                  />
                </label>

                <label className={labelClass}>
                  অ্যাকাউন্ট স্ট্যাটাস
                  <input
                    className={fieldClass}
                    value={profile.status}
                    readOnly
                    disabled
                  />
                </label>

                <label className={labelClass}>
                  অ্যাকাউন্ট তৈরি
                  <input
                    className={fieldClass}
                    value={
                      profile.createdAt
                        ? new Date(profile.createdAt).toLocaleDateString("bn-BD")
                        : "তথ্য পাওয়া যায়নি"
                    }
                    readOnly
                    disabled
                  />
                </label>
              </div>

              {editing && (
                <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-6">
                  <button
                    onClick={cancelEditing}
                    disabled={saving}
                    className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    বাতিল
                  </button>

                  <button
                    onClick={() => void saveProfile()}
                    disabled={saving}
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "সংরক্ষণ হচ্ছে..." : "পরিবর্তন সংরক্ষণ"}
                  </button>
                </div>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <h3 className="font-bold text-blue-900">
                💡 প্রোফাইল টিপস
              </h3>
              <p className="mt-2 text-sm leading-6 text-blue-800">
                সঠিক নাম ও যোগাযোগের তথ্য ব্যবহার করুন। ভবিষ্যতে কোর্স,
                পরীক্ষা ও সার্টিফিকেট ব্যবস্থাপনায় এই তথ্য কাজে লাগবে।
                অ্যাকাউন্টের ধরন Backend থেকে নির্ধারিত হয়; এখানে সেটি
                পরিবর্তন করা যাবে না।
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
