-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "QuestionReview" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "submittedBy" UUID,
    "reviewerId" UUID,
    "submissionNote" TEXT,
    "reviewNote" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionReview_status_submittedAt_idx" ON "QuestionReview"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "QuestionReview_questionId_submittedAt_idx" ON "QuestionReview"("questionId", "submittedAt");

-- CreateIndex
CREATE INDEX "QuestionReview_reviewerId_idx" ON "QuestionReview"("reviewerId");

-- AddForeignKey
ALTER TABLE "QuestionReview" ADD CONSTRAINT "QuestionReview_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
