/*
  Warnings:

  - Added the required column `examYear` to the `Exam` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "examYear" INTEGER NOT NULL,
ADD COLUMN     "postId" UUID;

-- CreateIndex
CREATE INDEX "Exam_postId_examYear_idx" ON "Exam"("postId", "examYear");

-- CreateIndex
CREATE INDEX "Exam_institutionId_postId_examYear_idx" ON "Exam"("institutionId", "postId", "examYear");

-- CreateIndex
CREATE INDEX "Exam_examYear_idx" ON "Exam"("examYear");

-- CreateIndex
CREATE INDEX "Exam_examType_idx" ON "Exam"("examType");

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
