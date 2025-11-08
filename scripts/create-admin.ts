/**
 * Create Admin User Script
 * 
 * This script creates an admin user in the database.
 * 
 * Usage:
 *   npx ts-node scripts/create-admin.ts
 * 
 * Or with custom credentials:
 *   ADMIN_EMAIL=admin@claimley.com ADMIN_PASSWORD=admin123 ADMIN_NAME="Admin User" npx ts-node scripts/create-admin.ts
 */

import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import prisma from '../src/config/prismaClient';
import logger from '../src/config/logger';

dotenv.config();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@claimley.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin User';
const ADMIN_ROLE = (process.env.ADMIN_ROLE as 'SUPER_ADMIN' | 'STAFF') || 'SUPER_ADMIN';

async function createAdmin() {
  try {
    logger.info('Starting admin user creation...', { email: ADMIN_EMAIL });

    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: ADMIN_EMAIL },
    });

    if (existingAdmin) {
      logger.warn('Admin user already exists', { email: ADMIN_EMAIL, adminId: existingAdmin.id.toString() });
      console.log(`❌ Admin with email ${ADMIN_EMAIL} already exists!`);
      console.log(`   Admin ID: ${existingAdmin.id.toString()}`);
      console.log(`   Role: ${existingAdmin.role}`);
      process.exit(1);
    }

    // Hash the password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, saltRounds);
    logger.debug('Password hashed successfully');

    // Create admin user
    const admin = await prisma.admin.create({
      data: {
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password_hash: passwordHash,
        role: ADMIN_ROLE,
      },
    });

    logger.info('Admin user created successfully', {
      adminId: admin.id.toString(),
      email: admin.email,
      role: admin.role,
    });

    console.log('\n✅ Admin user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email:    ${admin.email}`);
    console.log(`   Name:     ${admin.name}`);
    console.log(`   Role:     ${admin.role}`);
    console.log(`   Admin ID: ${admin.id.toString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    logger.error('Failed to create admin user', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    console.error('❌ Failed to create admin user:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createAdmin();

