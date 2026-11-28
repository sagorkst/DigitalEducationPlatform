import type { Metadata } from "next";
import AdminQuestionBankGate from "../../../../components/admin-question-bank-gate";

export const metadata: Metadata = {
  title: "Question Import Center",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminQuestionImportPage() {
  return <AdminQuestionBankGate page="import" />;
}