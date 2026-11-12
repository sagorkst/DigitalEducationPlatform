import type { Metadata } from "next";
import PublicQuestionDetail from "../../../components/public-question-detail";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api";

async function getQuestion(id: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/public/questions/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!response.ok) return null;
    const result = await response.json();
    return result.success ? result.data : null;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const question = await getQuestion(id);
  if (!question) return { title: "প্রশ্ন পাওয়া যায়নি", robots: { index: false, follow: false } };
  const title = String(question.questionText).slice(0, 90);
  return {
    title,
    description: `${question.subject} · ${question.topic || "প্রশ্নব্যাংক"} — শিক্ষাসেতুতে প্রকাশিত প্রশ্ন ও পরীক্ষার তথ্য পড়ুন।`,
    alternates: { canonical: `/question-bank/${id}` },
    openGraph: { title, description: `${question.subject} — Shikhasetu Question Bank` },
  };
}

export default async function QuestionDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicQuestionDetail id={id} />;
}
