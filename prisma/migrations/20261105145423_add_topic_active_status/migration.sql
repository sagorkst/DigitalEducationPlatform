-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Topic_isActive_idx" ON "Topic"("isActive");
