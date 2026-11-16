import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { Pool } from 'pg';

config({ path: resolve(__dirname, '../../../../.env') });

const userId = process.argv[2];

if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
  throw new Error('সঠিক User ID দিতে হবে।');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function main() {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        deletedAt: true,
      },
    });

    if (!user || user.status !== 'ACTIVE' || user.deletedAt !== null) {
      throw new Error('Account পাওয়া যায়নি অথবা Account ACTIVE নয়।');
    }

    const role = await tx.role.findUnique({
      where: { name: 'SUPER_ADMIN' },
      select: { id: true },
    });

    if (!role) {
      throw new Error('SUPER_ADMIN Role পাওয়া যায়নি। আগে Seed চালাও।');
    }

    const existingAssignments = await tx.userRole.findMany({
      where: { roleId: role.id },
      select: { userId: true },
    });

    const anotherAdmin = existingAssignments.find(
      (assignment) => assignment.userId !== userId,
    );

    if (anotherAdmin) {
      throw new Error('অন্য Account-এ SUPER_ADMIN রয়েছে। কোনো পরিবর্তন করা হয়নি।');
    }

    await tx.userRole.createMany({
      data: [{ userId, roleId: role.id }],
      skipDuplicates: true,
    });
  });

  console.log('SUPER_ADMIN successfully assigned.');
  console.log(`Account ID: ${userId}`);
  console.log('Other SUPER_ADMIN accounts: 0');
}

main()
  .catch((error) => {
    console.error('BOOTSTRAP FAILED:', error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });