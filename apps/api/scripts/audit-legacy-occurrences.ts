import "dotenv/config";

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL was not loaded from root .env");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  });

  try {
    await prisma.$connect();

    const [
      institutions,
      posts,
      exams,
      occurrences,
    ] = await Promise.all([
      prisma.institution.findMany({
        orderBy: { name: "asc" },
      }),
      prisma.post.findMany({
        orderBy: { name: "asc" },
      }),
      prisma.exam.findMany({
        include: {
          institution: true,
          post: true,
          _count: { select: { occurrences: true } },
        },
        orderBy: { examYear: "desc" },
      }),
      prisma.questionOccurrence.findMany({
        include: {
          question: {
            select: {
              id: true,
              status: true,
              questionText: true,
            },
          },
          examRef: {
            select: {
              id: true,
              examType: true,
              name: true,
              examYear: true,
            },
          },
        },
        orderBy: [
          { examYear: "desc" },
          { institution: "asc" },
          { examName: "asc" },
        ],
      }),
    ]);

    const groups = new Map<string, any>();

    for (const occurrence of occurrences) {
      const key = JSON.stringify([
        occurrence.institution.trim().toLowerCase(),
        occurrence.examName.trim().toLowerCase(),
        occurrence.examYear,
        occurrence.postName?.trim().toLowerCase() ?? null,
      ]);

      if (!groups.has(key)) {
        groups.set(key, {
          institution: occurrence.institution,
          examName: occurrence.examName,
          examYear: occurrence.examYear,
          postName: occurrence.postName,
          occurrenceCount: 0,
          questionIds: new Set<string>(),
          linkedExamIds: new Set<string>(),
          linkedInstitutionIds: new Set<string>(),
          linkedPostIds: new Set<string>(),
          examTypes: new Set<string>(),
        });
      }

      const group = groups.get(key);
      group.occurrenceCount++;
      group.questionIds.add(occurrence.questionId);

      if (occurrence.examId) group.linkedExamIds.add(occurrence.examId);
      if (occurrence.institutionId) {
        group.linkedInstitutionIds.add(occurrence.institutionId);
      }
      if (occurrence.postId) group.linkedPostIds.add(occurrence.postId);
      if (occurrence.examRef?.examType) {
        group.examTypes.add(occurrence.examRef.examType);
      }
    }

    const report = {
      auditType: "READ_ONLY",
      generatedAt: new Date().toISOString(),

      summary: {
        institutions: institutions.length,
        posts: posts.length,
        exams: exams.length,
        occurrences: occurrences.length,
        uniqueQuestionsInOccurrences:
          new Set(occurrences.map((o) => o.questionId)).size,
      },

      normalizedInstitutions: institutions.map((i) => ({
        id: i.id,
        name: i.name,
        slug: i.slug,
        isActive: i.isActive,
      })),

      normalizedPosts: posts.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
      })),

      normalizedExams: exams.map((e) => ({
        id: e.id,
        name: e.name,
        examYear: e.examYear,
        examType: e.examType,
        institution: e.institution?.name ?? null,
        institutionId: e.institutionId,
        post: e.post?.name ?? null,
        postId: e.postId,
        occurrenceCount: e._count.occurrences,
      })),

      legacyGroups: Array.from(groups.values()).map((g) => ({
        institution: g.institution,
        examName: g.examName,
        examYear: g.examYear,
        postName: g.postName,
        occurrenceCount: g.occurrenceCount,
        distinctQuestionCount: g.questionIds.size,
        linkedExamIds: Array.from(g.linkedExamIds),
        linkedInstitutionIds: Array.from(g.linkedInstitutionIds),
        linkedPostIds: Array.from(g.linkedPostIds),
        examTypes: Array.from(g.examTypes),
      })),

      occurrenceDetails: occurrences.map((o) => ({
        id: o.id,
        questionId: o.questionId,
        questionStatus: o.question.status,
        questionText: o.question.questionText,
        institution: o.institution,
        examName: o.examName,
        examYear: o.examYear,
        postName: o.postName,
        department: o.department,
        questionNumber: o.questionNumber,
        institutionId: o.institutionId,
        examId: o.examId,
        postId: o.postId,
        linkedExamType: o.examRef?.examType ?? null,
        source: o.source,
        sourcePage: o.sourcePage,
      })),
    };

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("READ-ONLY AUDIT FAILED:");
  console.error(error);
  process.exitCode = 1;
});
