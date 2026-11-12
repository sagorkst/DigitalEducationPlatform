import type { Metadata } from "next";
import AdminQuestionBankGate from "../../../components/admin-question-bank-gate";

export const metadata: Metadata = { title: "প্রশ্নব্যাংক ব্যবস্থাপনা", robots: { index: false, follow: false } };

export default function AdminQuestionBankPage() {
  return <AdminQuestionBankGate />;
}
