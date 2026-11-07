-- DropForeignKey
ALTER TABLE "QuestionOccurrence" DROP CONSTRAINT "QuestionOccurrence_examId_fkey";

-- AddForeignKey
ALTER TABLE "QuestionOccurrence" ADD CONSTRAINT "QuestionOccurrence_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
