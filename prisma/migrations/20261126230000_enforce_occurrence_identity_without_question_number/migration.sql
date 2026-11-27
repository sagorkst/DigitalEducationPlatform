-- Question Number is paper-position metadata, not occurrence identity.
-- Fail safely when historical duplicates exist; never delete or merge user data.
DO $$
DECLARE
  exam_duplicate_groups BIGINT;
  legacy_duplicate_groups BIGINT;
BEGIN
  SELECT COUNT(*) INTO exam_duplicate_groups
  FROM (
    SELECT "questionId", "institutionId", "examId", "examYear", "postId"
    FROM "QuestionOccurrence"
    WHERE "examId" IS NOT NULL
    GROUP BY "questionId", "institutionId", "examId", "examYear", "postId"
    HAVING COUNT(*) > 1
  ) AS duplicates;

  SELECT COUNT(*) INTO legacy_duplicate_groups
  FROM (
    SELECT "questionId", "institutionId", "institution", "examName", "examYear", "postId", "postName"
    FROM "QuestionOccurrence"
    WHERE "examId" IS NULL
      AND ("institutionId" IS NOT NULL OR NULLIF(BTRIM("institution"), '') IS NOT NULL)
      AND NULLIF(BTRIM("examName"), '') IS NOT NULL
    GROUP BY "questionId", "institutionId", "institution", "examName", "examYear", "postId", "postName"
    HAVING COUNT(*) > 1
  ) AS duplicates;

  IF exam_duplicate_groups > 0 OR legacy_duplicate_groups > 0 THEN
    RAISE EXCEPTION
      'Occurrence identity migration stopped safely: % Exam-linked duplicate group(s), % legacy duplicate group(s) exist. No data was deleted. Review and resolve duplicate QuestionOccurrence rows, then retry this migration.',
      exam_duplicate_groups,
      legacy_duplicate_groups
      USING ERRCODE = '23505';
  END IF;
END $$;

DROP INDEX IF EXISTS "QuestionOccurrence_exam_unique_idx";
DROP INDEX IF EXISTS "QuestionOccurrence_legacy_unique_idx";

CREATE UNIQUE INDEX "QuestionOccurrence_exam_unique_idx"
ON "QuestionOccurrence" ("questionId", "institutionId", "examId", "examYear", "postId")
NULLS NOT DISTINCT
WHERE "examId" IS NOT NULL;

CREATE UNIQUE INDEX "QuestionOccurrence_legacy_unique_idx"
ON "QuestionOccurrence" ("questionId", "institutionId", "institution", "examName", "examYear", "postId", "postName")
NULLS NOT DISTINCT
WHERE "examId" IS NULL
  AND ("institutionId" IS NOT NULL OR NULLIF(BTRIM("institution"), '') IS NOT NULL)
  AND NULLIF(BTRIM("examName"), '') IS NOT NULL;
