-- Import preview permits question-only rows. Keep existing rows unchanged while allowing metadata to be added later.
ALTER TABLE "Question"
  ALTER COLUMN "subject" SET DEFAULT '',
  ALTER COLUMN "topic" SET DEFAULT '';

ALTER TABLE "QuestionOccurrence"
  ALTER COLUMN "institution" DROP NOT NULL,
  ALTER COLUMN "examName" DROP NOT NULL,
  ALTER COLUMN "examYear" DROP NOT NULL;
