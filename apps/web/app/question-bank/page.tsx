import type { Metadata } from "next";
import PublicQuestionBank from "../../components/public-question-bank";

export const metadata: Metadata = {
  title: "প্রশ্নব্যাংক",
  description: "বাংলাদেশের চাকরি, ভর্তি ও একাডেমিক পরীক্ষার প্রকাশিত প্রশ্ন পড়ুন। লগইন ছাড়াই প্রশ্ন, অপশন, উত্তর ও ব্যাখ্যা দেখুন।",
  alternates: { canonical: "/question-bank" },
};

export default function QuestionBankPage() {
  return <PublicQuestionBank />;
}
