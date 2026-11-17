-- Store the job grade associated with a specific examination.
ALTER TABLE "Exam" ADD COLUMN "grade" TEXT;
CREATE INDEX "Exam_grade_idx" ON "Exam"("grade");
