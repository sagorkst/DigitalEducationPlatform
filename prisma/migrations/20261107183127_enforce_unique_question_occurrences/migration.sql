CREATE UNIQUE INDEX "QuestionOccurrence_exam_unique_idx"
ON "QuestionOccurrence" (
  "questionId",
  "examId",
  "examYear",
  "postId",
  "questionNumber"
)
NULLS NOT DISTINCT
WHERE "examId" IS NOT NULL;

CREATE UNIQUE INDEX "QuestionOccurrence_legacy_unique_idx"
ON "QuestionOccurrence" (
  "questionId",
  "institution",
  "examName",
  "examYear",
  "postName",
  "postId",
  "questionNumber"
)
NULLS NOT DISTINCT
WHERE "examId" IS NULL;