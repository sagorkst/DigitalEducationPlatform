import type { Metadata } from "next";
import AdminQuestionBankGate from "../../../components/admin-question-bank-gate";

export const metadata: Metadata = {
  title: "Question Bank Management",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminQuestionsPage() {
  return <AdminQuestionBankGate />;
}