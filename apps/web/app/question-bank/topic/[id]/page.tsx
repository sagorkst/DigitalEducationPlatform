import type { Metadata } from "next";
import PublicQuestionBank from "../../../../components/public-question-bank";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api";

async function getTopic(id: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/public/filters`, { next: { revalidate: 3600 } });
    const result = await response.json();
    return response.ok ? result.data?.topics?.find((item: { id: string }) => item.id === id) ?? null : null;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const topic = await getTopic(id);
  if (!topic) return { title: "টপিক পাওয়া যায়নি", robots: { index: false, follow: false } };
  return {
    title: `${topic.name} প্রশ্ন`,
    description: `${topic.subject?.name ?? "প্রশ্নব্যাংক"} — ${topic.name} টপিকের প্রকাশিত প্রশ্ন পড়ুন।`,
    alternates: { canonical: `/question-bank/topic/${id}` },
  };
}

export default async function TopicQuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicQuestionBank initialTopicId={id} />;
}

export const instant = false;
