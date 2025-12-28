import 'dotenv/config';
import bcrypt from 'bcrypt';
import { AdminRole, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function resolveAdminRole(role?: string | null): AdminRole {
  if (!role) {
    return AdminRole.SUPER_ADMIN;
  }

  return role === AdminRole.STAFF ? AdminRole.STAFF : AdminRole.SUPER_ADMIN;
}

async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@claimley.com';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';
  const adminName = process.env.ADMIN_NAME ?? 'Admin User';
  const adminRole = resolveAdminRole(process.env.ADMIN_ROLE);

  const existingAdmin = await prisma.admin.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log(`ℹ️  Admin already exists: ${adminEmail}`);
    return existingAdmin;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.admin.create({
    data: {
      name: adminName,
      email: adminEmail,
      password_hash: passwordHash,
      role: adminRole,
    },
  });

  console.log(`✅ Admin created: ${admin.email}`);
  return admin;
}

async function main() {
  console.log('🌱 Seeding development database (admin only)...');

  const admin = await seedAdmin();

  console.log('──────────────────────────────────────────');
  console.log(` Admin Email: ${admin.email}`);
  console.log(` Admin Role:  ${admin.role}`);
  console.log('──────────────────────────────────────────');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

