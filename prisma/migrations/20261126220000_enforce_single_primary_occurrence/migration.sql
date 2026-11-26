-- Keep all historical occurrence rows. If legacy data contains multiple primary flags,
-- preserve the earliest-created primary and demote the remaining flags before enforcing the invariant.
WITH ranked_primary AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "questionId"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS position
  FROM "QuestionOccurrence"
  WHERE "isPrimary" = TRUE
)
UPDATE "QuestionOccurrence" AS occurrence
SET "isPrimary" = FALSE
FROM ranked_primary
WHERE occurrence."id" = ranked_primary."id"
  AND ranked_primary.position > 1;

CREATE UNIQUE INDEX "QuestionOccurrence_single_primary_per_question_idx"
ON "QuestionOccurrence" ("questionId")
WHERE "isPrimary" = TRUE;
