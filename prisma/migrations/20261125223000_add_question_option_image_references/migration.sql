ALTER TABLE "Question"
ADD COLUMN "imageReferences" JSONB;

ALTER TABLE "QuestionOption"
ADD COLUMN "imageReferences" JSONB;
