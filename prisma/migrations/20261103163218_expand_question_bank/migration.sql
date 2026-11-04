-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'REVIEW', 'COMPLETED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'DUPLICATE', 'IMPORTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "DuplicateStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'MERGED');

-- DropIndex
DROP INDEX "Question_questionText_idx";

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "subjectId" UUID,
ADD COLUMN     "topicId" UUID;

-- AlterTable
ALTER TABLE "QuestionOccurrence" ADD COLUMN     "examId" UUID,
ADD COLUMN     "institutionId" UUID,
ADD COLUMN     "postId" UUID,
ADD COLUMN     "sourceDocumentId" UUID;

-- CreateTable
CREATE TABLE "Subject" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "parentId" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Institution" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT,
    "description" TEXT,
    "website" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" UUID NOT NULL,
    "institutionId" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "examType" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionOption" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "optionText" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionHistory" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changeNote" TEXT,
    "changedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "documentType" TEXT,
    "fileName" TEXT,
    "fileUrl" TEXT,
    "fileHash" TEXT,
    "description" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "createdBy" UUID,
    "errorSummary" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessages" JSONB,
    "questionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuplicateCandidate" (
    "id" UUID NOT NULL,
    "questionAId" UUID NOT NULL,
    "questionBId" UUID NOT NULL,
    "similarity" DOUBLE PRECISION NOT NULL,
    "status" "DuplicateStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuplicateCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedFilter" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedFilter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionTag" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionTagLink" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "QuestionTagLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subject_slug_key" ON "Subject"("slug");

-- CreateIndex
CREATE INDEX "Subject_isActive_idx" ON "Subject"("isActive");

-- CreateIndex
CREATE INDEX "Topic_subjectId_parentId_idx" ON "Topic"("subjectId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_subjectId_slug_key" ON "Topic"("subjectId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_slug_key" ON "Institution"("slug");

-- CreateIndex
CREATE INDEX "Institution_name_idx" ON "Institution"("name");

-- CreateIndex
CREATE INDEX "Institution_isActive_idx" ON "Institution"("isActive");

-- CreateIndex
CREATE INDEX "Exam_institutionId_name_idx" ON "Exam"("institutionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");

-- CreateIndex
CREATE INDEX "Post_name_idx" ON "Post"("name");

-- CreateIndex
CREATE INDEX "QuestionOption_questionId_sortOrder_idx" ON "QuestionOption"("questionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_questionId_label_key" ON "QuestionOption"("questionId", "label");

-- CreateIndex
CREATE INDEX "QuestionHistory_questionId_createdAt_idx" ON "QuestionHistory"("questionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionHistory_questionId_version_key" ON "QuestionHistory"("questionId", "version");

-- CreateIndex
CREATE INDEX "SourceDocument_fileHash_idx" ON "SourceDocument"("fileHash");

-- CreateIndex
CREATE INDEX "SourceDocument_title_idx" ON "SourceDocument"("title");

-- CreateIndex
CREATE INDEX "ImportBatch_status_createdAt_idx" ON "ImportBatch"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ImportBatch_createdBy_createdAt_idx" ON "ImportBatch"("createdBy", "createdAt");

-- CreateIndex
CREATE INDEX "ImportRow_batchId_status_idx" ON "ImportRow"("batchId", "status");

-- CreateIndex
CREATE INDEX "ImportRow_questionId_idx" ON "ImportRow"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportRow_batchId_rowNumber_key" ON "ImportRow"("batchId", "rowNumber");

-- CreateIndex
CREATE INDEX "DuplicateCandidate_status_similarity_idx" ON "DuplicateCandidate"("status", "similarity");

-- CreateIndex
CREATE UNIQUE INDEX "DuplicateCandidate_questionAId_questionBId_key" ON "DuplicateCandidate"("questionAId", "questionBId");

-- CreateIndex
CREATE INDEX "SavedFilter_userId_idx" ON "SavedFilter"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedFilter_userId_name_key" ON "SavedFilter"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionTag_name_key" ON "QuestionTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionTag_slug_key" ON "QuestionTag"("slug");

-- CreateIndex
CREATE INDEX "QuestionTagLink_tagId_idx" ON "QuestionTagLink"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionTagLink_questionId_tagId_key" ON "QuestionTagLink"("questionId", "tagId");

-- CreateIndex
CREATE INDEX "Question_subjectId_topicId_idx" ON "Question"("subjectId", "topicId");

-- CreateIndex
CREATE INDEX "Question_createdAt_idx" ON "Question"("createdAt");

-- CreateIndex
CREATE INDEX "QuestionOccurrence_institutionId_examYear_idx" ON "QuestionOccurrence"("institutionId", "examYear");

-- CreateIndex
CREATE INDEX "QuestionOccurrence_examId_examYear_idx" ON "QuestionOccurrence"("examId", "examYear");

-- CreateIndex
CREATE INDEX "QuestionOccurrence_postId_idx" ON "QuestionOccurrence"("postId");

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOccurrence" ADD CONSTRAINT "QuestionOccurrence_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOccurrence" ADD CONSTRAINT "QuestionOccurrence_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOccurrence" ADD CONSTRAINT "QuestionOccurrence_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOccurrence" ADD CONSTRAINT "QuestionOccurrence_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionHistory" ADD CONSTRAINT "QuestionHistory_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateCandidate" ADD CONSTRAINT "DuplicateCandidate_questionAId_fkey" FOREIGN KEY ("questionAId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateCandidate" ADD CONSTRAINT "DuplicateCandidate_questionBId_fkey" FOREIGN KEY ("questionBId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedFilter" ADD CONSTRAINT "SavedFilter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionTagLink" ADD CONSTRAINT "QuestionTagLink_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionTagLink" ADD CONSTRAINT "QuestionTagLink_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "QuestionTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
