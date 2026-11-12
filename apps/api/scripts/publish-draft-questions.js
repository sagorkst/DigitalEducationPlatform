"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const node_path_1 = require("node:path");
const prisma_service_1 = require("../src/database/prisma.service");
(0, dotenv_1.config)({ path: (0, node_path_1.resolve)(process.cwd(), ".env") });
async function main() {
    if (!process.env.DATABASE_URL) {
        throw new Error("Root .env থেকে DATABASE_URL পাওয়া যায়নি।");
    }
    const prisma = new prisma_service_1.PrismaService();
    try {
        await prisma.$connect();
        const before = await prisma.question.count({
            where: { status: "DRAFT" },
        });
        console.log(`DRAFT questions found: ${before}`);
        const result = await prisma.question.updateMany({
            where: { status: "DRAFT" },
            data: { status: "PUBLISHED" },
        });
        console.log("\n========== PUBLISH RESULT ==========");
        console.log(`Updated: ${result.count}`);
        console.log(`Remaining DRAFT: ${await prisma.question.count({ where: { status: "DRAFT" } })}`);
        console.log(`Total PUBLISHED: ${await prisma.question.count({ where: { status: "PUBLISHED" } })}`);
    }
    finally {
        await prisma.$disconnect();
    }
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=publish-draft-questions.js.map