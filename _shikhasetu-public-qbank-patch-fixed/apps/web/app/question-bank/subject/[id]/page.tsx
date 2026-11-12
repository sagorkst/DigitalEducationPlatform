import type { Metadata } from "next";
import PublicQuestionBank from "../../../../components/public-question-bank";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api";

async function getSubject(id: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/public/subjects`, { next: { revalidate: 3600 } });
    const result = await response.json();
    return response.ok ? result.data?.find((item: { id: string }) => item.id === id) ?? null : null;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const subject = await getSubject(id);
  if (!subject) return { title: "বিষয় পাওয়া যায়নি", robots: { index: false, follow: false } };
  return {
    title: `${subject.name} প্রশ্নব্যাংক`,
    description: `${subject.name} বিষয়ের প্রকাশিত প্রশ্ন ও অধ্যায়ভিত্তিক অনুশীলন প্রশ্ন পড়ুন।`,
    alternates: { canonical: `/question-bank/subject/${id}` },
  };
}

export default async function SubjectQuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicQuestionBank initialSubjectId={id} />;
}
