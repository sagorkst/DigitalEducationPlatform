ALTER TABLE "QuestionOccurrence"
ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "QuestionOccurrence_one_primary_per_question"
ON "QuestionOccurrence" ("questionId")
WHERE "isPrimary" = true;
