import { config } from "dotenv";
import { resolve } from "node:path";
import { PrismaService } from "../src/database/prisma.service";

config({ path: resolve(process.cwd(), ".env") });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Root .env থেকে DATABASE_URL পাওয়া যায়নি।");
  }

  const prisma = new PrismaService();

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

    console.log(
      `Remaining DRAFT: ${await prisma.question.count({ where: { status: "DRAFT" } })}`,
    );
    console.log(
      `Total PUBLISHED: ${await prisma.question.count({ where: { status: "PUBLISHED" } })}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
