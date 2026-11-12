import { Suspense } from "react";
import PublicExamQuestions from "../../../../components/public-exam-questions";

async function ExamPageContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <PublicExamQuestions examId={id} />;
}

export default function PublicExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-6">Loading exam questions...</div>}>
      <ExamPageContent params={params} />
    </Suspense>
  );
}
