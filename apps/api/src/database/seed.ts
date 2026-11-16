import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { Pool } from 'pg';

config({ path: resolve(__dirname, '../../../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const roles = [
  {
    name: 'USER',
    description: 'সাধারণ নিবন্ধিত ব্যবহারকারী ও শিক্ষার্থী',
  },
  {
    name: 'MODERATOR',
    description: 'কনটেন্ট ও প্রশ্ন পর্যবেক্ষণকারী',
  },
  {
    name: 'ADMIN',
    description: 'প্ল্যাটফর্ম প্রশাসক',
  },
  {
    name: 'SUPER_ADMIN',
    description: 'প্ল্যাটফর্মের সর্বোচ্চ প্রশাসনিক নিয়ন্ত্রণ',
  },
];

const permissions = [
  { key: 'profile.read', description: 'নিজের প্রোফাইল দেখা' },
  { key: 'profile.update', description: 'নিজের প্রোফাইল পরিবর্তন' },
  { key: 'questions.read', description: 'প্রশ্ন দেখা' },
  { key: 'exams.read', description: 'পরীক্ষা দেখা' },
  { key: 'exams.attempt', description: 'পরীক্ষায় অংশগ্রহণ' },
  { key: 'results.read', description: 'নিজের ফলাফল দেখা' },
  { key: 'library.read', description: 'ডিজিটাল লাইব্রেরি ব্যবহার' },
  { key: 'content.review', description: 'কনটেন্ট পর্যালোচনা' },
  { key: 'questions.review', description: 'প্রশ্ন পর্যালোচনা' },
  { key: 'users.moderate', description: 'ব্যবহারকারী পর্যবেক্ষণ' },
  { key: 'users.manage', description: 'ব্যবহারকারী পরিচালনা' },
  { key: 'content.manage', description: 'কনটেন্ট পরিচালনা' },
  { key: 'rbac.manage', description: 'Role ও Permission পরিচালনা' },
  { key: 'analytics.read', description: 'প্ল্যাটফর্ম রিপোর্ট দেখা' },
  { key: 'audit.logs.read', description: 'অডিট লগ দেখা' },
  { key: 'system.settings.manage', description: 'সিস্টেম সেটিংস পরিচালনা' },

  // Subject and Topic management
  { key: 'subjects.manage', description: 'বিষয় পরিচালনা' },
  { key: 'topics.manage', description: 'বিষয়ভিত্তিক টপিক পরিচালনা' },
];

async function main() {
  console.log('Creating default roles...');

  const roleRecords = await Promise.all(
    roles.map((role) =>
      prisma.role.upsert({
        where: { name: role.name },
        update: { description: role.description },
        create: role,
      }),
    ),
  );

  console.log('Creating default permissions...');

  const permissionRecords = await Promise.all(
    permissions.map((permission) =>
      prisma.permission.upsert({
        where: { key: permission.key },
        update: { description: permission.description },
        create: permission,
      }),
    ),
  );

  const roleIds = Object.fromEntries(
    roleRecords.map((role) => [role.name, role.id]),
  );

  const permissionIds = Object.fromEntries(
    permissionRecords.map((permission) => [permission.key, permission.id]),
  );

  const userPermissions = [
    'profile.read',
    'profile.update',
    'questions.read',
    'exams.read',
    'exams.attempt',
    'results.read',
    'library.read',
  ];

  const moderatorPermissions = [
    ...userPermissions,
    'content.review',
    'questions.review',
    'users.moderate',
  ];

  const adminPermissions = permissions
    .map((permission) => permission.key)
    .filter(
      (key) =>
        key !== 'system.settings.manage' &&
        key !== 'rbac.manage',
    );

  const superAdminPermissions = permissions.map(
    (permission) => permission.key,
  );

  const assignments: Array<{
    roleId: string;
    permissionId: string;
  }> = [];

  const rolePermissionMap: Record<string, string[]> = {
    USER: userPermissions,
    MODERATOR: moderatorPermissions,
    ADMIN: adminPermissions,
    SUPER_ADMIN: superAdminPermissions,
  };

  for (const [roleName, permissionKeys] of Object.entries(rolePermissionMap)) {
    const roleId = roleIds[roleName];

    if (!roleId) {
      throw new Error(`Role ID পাওয়া যায়নি: ${roleName}`);
    }

    for (const permissionKey of permissionKeys) {
      const permissionId = permissionIds[permissionKey];

      if (!permissionId) {
        throw new Error(`Permission ID পাওয়া যায়নি: ${permissionKey}`);
      }

      assignments.push({ roleId, permissionId });
    }
  }

  await prisma.rolePermission.createMany({
    data: assignments,
    skipDuplicates: true,
  });

  // Remove any previously assigned RBAC management permission from ADMIN.
  const adminRoleId = roleIds['ADMIN'];
  const rbacManagePermissionId = permissionIds['rbac.manage'];

  if (adminRoleId && rbacManagePermissionId) {
    await prisma.rolePermission.deleteMany({
      where: {
        roleId: adminRoleId,
        permissionId: rbacManagePermissionId,
      },
    });
  }

  console.log('\n========== SEED SUMMARY ==========');
  console.log(`Roles: ${roleRecords.length}`);
  console.log(`Permissions: ${permissionRecords.length}`);
  console.log(`Role-Permission links processed: ${assignments.length}`);
  console.log('Subject management: ADMIN, SUPER_ADMIN');
  console.log('Topic management: ADMIN, SUPER_ADMIN');
  console.log('Subject and Topic read APIs: PUBLIC');
  console.log('SUPER_ADMIN assigned to users: NO');
  console.log('ADMIN assigned to users: NO');
  console.log('\nDefault roles and permissions seeded successfully.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });