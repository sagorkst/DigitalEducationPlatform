"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminQuestionBank from "./admin-question-bank";
import QuestionImportPanel from "./question-import-panel";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getAccessValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;

  if (!isRecord(value)) return undefined;

  const candidate = value.name ?? value.code ?? value.role;
  return typeof candidate === "string" ? candidate : undefined;
}

function hasQuestionManagementAccess(payload: unknown): boolean {
  if (!isRecord(payload)) return false;

  const data = isRecord(payload.data) ? payload.data : undefined;

  const candidates = [
    data,
    data?.user,
    data?.account,
    payload.user,
    payload.account,
  ].filter(isRecord);

  for (const item of candidates) {
    const rawRoles = [
      item.role,
      ...(Array.isArray(item.roles) ? item.roles : []),
    ];

    const roles = rawRoles
      .map(getAccessValue)
      .filter((role): role is string => Boolean(role));

    const permissions = (
      Array.isArray(item.permissions) ? item.permissions : []
    )
      .map((permission) => {
        if (typeof permission === "string") return permission;
        if (!isRecord(permission)) return undefined;

        const candidate = permission.name ?? permission.code;
        return typeof candidate === "string" ? candidate : undefined;
      })
      .filter((permission): permission is string => Boolean(permission));

    if (
      roles.includes("SUPER_ADMIN") ||
      roles.includes("ADMIN") ||
      permissions.includes("content.manage")
    ) {
      return true;
    }
  }

  return false;
}

export default function AdminQuestionBankGate({ page = "questions" }: { page?: "questions" | "import" }) {
  const [state, setState] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((payload) => {
        if (active) setState(payload && hasQuestionManagementAccess(payload) ? "allowed" : "denied");
      })
      .catch(() => {
        if (active) setState("denied");
      });
    return () => { active = false; };
  }, []);

  if (state === "loading") return <main className="mx-auto max-w-4xl px-4 py-16 text-center text-slate-500">à¦…à¦¨à§à¦®à¦¤à¦¿ à¦¯à¦¾à¦šà¦¾à¦‡ à¦¹à¦šà§à¦›à§‡...</main>;
  if (state === "denied") return <main className="mx-auto max-w-4xl px-4 py-16"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center"><h1 className="text-xl font-bold text-slate-900">à¦ªà§à¦°à¦¬à§‡à¦¶à¦¾à¦§à¦¿à¦•à¦¾à¦° à¦¨à§‡à¦‡</h1><p className="mt-2 text-sm text-slate-600">à¦ªà§à¦°à¦¶à§à¦¨à¦¬à§à¦¯à¦¾à¦‚à¦• à¦¬à§à¦¯à¦¬à¦¸à§à¦¥à¦¾à¦ªà¦¨à¦¾ à¦¦à§‡à¦–à¦¤à§‡ à¦…à¦¨à§à¦®à§‹à¦¦à¦¿à¦¤ à¦…à§à¦¯à¦¾à¦•à¦¾à¦‰à¦¨à§à¦Ÿ à¦ªà§à¦°à§Ÿà§‹à¦œà¦¨à¥¤</p><Link href="/question-bank" className="mt-5 inline-block rounded-lg bg-[#142B49] px-4 py-2 text-sm font-bold text-white">Public Question Bank</Link></div></main>;
  return page === "import" ? <QuestionImportPanel /> : <AdminQuestionBank />;
}
