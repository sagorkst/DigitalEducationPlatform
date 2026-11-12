"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const node_crypto_1 = require("node:crypto");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const client_1 = require("../src/generated/prisma/client");
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
});
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
const publishedQuestionIds = [
    "4ef1ca81-4712-48c7-aca0-db0191c6dea8",
    "644a9c74-4c3c-434e-9020-7aa9d641f995",
    "2b846cb3-3407-4927-b736-984f95f18611",
];
function makeSlug(value) {
    const base = value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "record";
    const hash = (0, node_crypto_1.createHash)("sha256")
        .update(value)
        .digest("hex")
        .slice(0, 8);
    return `${base}-${hash}`;
}
async function main() {
    console.log("\n========== LEGACY DATA REPAIR ==========");
    const occurrences = await prisma.questionOccurrence.findMany({
        select: {
            id: true,
            questionId: true,
            institution: true,
            examName: true,
            examYear: true,
            postName: true,
            examId: true,
        },
        orderBy: { createdAt: "asc" },
    });
    const sampleRows = occurrences.filter((row) => /\bsample\b/i.test(row.examName) &&
        row.institution.trim().length > 0 &&
        row.examName.trim().length > 0);
    const groups = new Map();
    for (const row of sampleRows) {
        const institution = row.institution.trim();
        const examName = row.examName.trim();
        const postName = row.postName?.trim() || null;
        const key = JSON.stringify([
            institution,
            examName,
            row.examYear,
            postName,
        ]);
        const existing = groups.get(key) ?? [];
        existing.push(row);
        groups.set(key, existing);
    }
    console.log("Total occurrences:", occurrences.length);
    console.log("Sample occurrences:", sampleRows.length);
    console.log("Unique Sample Exam groups:", groups.size);
    const result = await prisma.$transaction(async (tx) => {
        let demotedQuestions = 0;
        let institutionsCreated = 0;
        let postsCreated = 0;
        let examsCreated = 0;
        let occurrencesLinked = 0;
        const demotion = await tx.question.updateMany({
            where: {
                id: { in: publishedQuestionIds },
                status: "PUBLISHED",
            },
            data: { status: "DRAFT" },
        });
        demotedQuestions = demotion.count;
        for (const rows of groups.values()) {
            const first = rows[0];
            const institutionName = first.institution.trim();
            const examName = first.examName.trim();
            const postName = first.postName?.trim() || null;
            let institution = await tx.institution.findFirst({
                where: { name: institutionName },
            });
            if (!institution) {
                institution = await tx.institution.create({
                    data: {
                        name: institutionName,
                        slug: makeSlug(institutionName),
                        isActive: true,
                    },
                });
                institutionsCreated++;
            }
            let post = null;
            if (postName) {
                post = await tx.post.findFirst({
                    where: { name: postName },
                });
                if (!post) {
                    post = await tx.post.create({
                        data: {
                            name: postName,
                            slug: makeSlug(postName),
                        },
                    });
                    postsCreated++;
                }
            }
            let exam = await tx.exam.findFirst({
                where: {
                    institutionId: institution.id,
                    postId: post?.id ?? null,
                    name: examName,
                    examYear: first.examYear,
                },
            });
            if (!exam) {
                exam = await tx.exam.create({
                    data: {
                        institutionId: institution.id,
                        postId: post?.id ?? null,
                        name: examName,
                        slug: makeSlug(`${institutionName}-${examName}-${first.examYear}-${postName ?? ""}`),
                        examYear: first.examYear,
                        examType: null,
                    },
                });
                examsCreated++;
            }
            const ids = rows.map((row) => row.id);
            const linked = await tx.questionOccurrence.updateMany({
                where: {
                    id: { in: ids },
                    examId: null,
                },
                data: {
                    institutionId: institution.id,
                    examId: exam.id,
                    postId: post?.id ?? null,
                },
            });
            occurrencesLinked += linked.count;
            console.log(`LINKED: ${institutionName} | ${examName} | ${first.examYear} | ${postName ?? "No Post"} | ${linked.count} occurrences`);
        }
        return {
            demotedQuestions,
            institutionsCreated,
            postsCreated,
            examsCreated,
            occurrencesLinked,
        };
    });
    console.log("\n========== REPAIR RESULT ==========");
    console.log(JSON.stringify(result, null, 2));
    const verification = await prisma.questionOccurrence.count({
        where: { examId: { not: null } },
    });
    const remainingPublished = await prisma.question.count({
        where: { status: "PUBLISHED" },
    });
    console.log("\n========== VERIFICATION ==========");
    console.log("Linked occurrences:", verification);
    console.log("Remaining published questions:", remainingPublished);
    console.log("Repair transaction completed.");
}
main()
    .catch((error) => {
    console.error("\nREPAIR FAILED:");
    console.error(error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
});
//# sourceMappingURL=repair-legacy-occurrences.js.map