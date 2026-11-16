import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { Pool } from 'pg';

config({ path: resolve(__dirname, '../../../../.env') });

const userId = process.argv[2];

if (
  !userId ||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
) {
  throw new Error('A valid user UUID is required.');
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not configured.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function main() {
  await prisma.$transaction(async (tx) => {
    // Serialize every bootstrap attempt across processes.
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(7411132026::bigint)
    `;

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        deletedAt: true,
      },
    });

    if (!user || user.status !== 'ACTIVE' || user.deletedAt !== null) {
      throw new Error('Target account must exist, be ACTIVE, and not be deleted.');
    }

    const role = await tx.role.findUnique({
      where: { name: 'SUPER_ADMIN' },
      select: { id: true },
    });

    if (!role) {
      throw new Error('SUPER_ADMIN role does not exist. Run the seed first.');
    }

    const existingAssignments = await tx.userRole.findMany({
      where: { roleId: role.id },
      select: { userId: true },
    });

    const anotherAdmin = existingAssignments.find(
      (assignment) => assignment.userId !== userId,
    );

    if (anotherAdmin) {
      throw new Error(
        'A different SUPER_ADMIN account already exists. No assignment was made.',
      );
    }

    await tx.userRole.createMany({
      data: [{ userId, roleId: role.id }],
      skipDuplicates: true,
    });
  });

  console.log('SUPER_ADMIN bootstrap successful.');
  console.log(`Account ID: ${userId}`);
  console.log('Exactly one SUPER_ADMIN account is enforced by this bootstrap process.');
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