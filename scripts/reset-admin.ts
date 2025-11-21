/**
 * Reset Admin User Script
 * 
 * This script deletes all existing admin users and creates a single admin
 * with the specified credentials.
 * 
 * Usage:
 *   npm run reset:admin
 *   OR
 *   npx ts-node scripts/reset-admin.ts
 * 
 * With environment variables:
 *   ADMIN_EMAIL=admin@claimly.com ADMIN_PASSWORD=admin123 npm run reset:admin
 * 
 * For production (requires FORCE_RESET=true):
 *   FORCE_RESET=true ADMIN_EMAIL=admin@claimly.com ADMIN_PASSWORD=secure_password npm run reset:admin
 * 
 * Default credentials (if not set via env):
 *   Email: admin@claimly.com
 *   Password: admin123
 */

import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import prisma from '../src/config/prismaClient';
import logger from '../src/config/logger';

dotenv.config();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@claimly.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin User';
const ADMIN_ROLE = (process.env.ADMIN_ROLE as 'SUPER_ADMIN' | 'STAFF') || 'SUPER_ADMIN';
const FORCE_RESET = process.env.FORCE_RESET === 'true';
const NODE_ENV = process.env.NODE_ENV || 'development';

async function resetAdmin() {
  try {
    // Safety check for production
    if (NODE_ENV === 'production' && !FORCE_RESET) {
      console.error('❌ ERROR: Cannot reset admin in production without FORCE_RESET=true');
      console.error('   This is a safety measure to prevent accidental data loss.');
      console.error('   If you really want to proceed, run:');
      console.error('   FORCE_RESET=true npx ts-node scripts/reset-admin.ts');
      process.exit(1);
    }

    // Warn if using default password in production
    if (NODE_ENV === 'production' && ADMIN_PASSWORD === 'admin123') {
      console.error('❌ ERROR: Cannot use default password "admin123" in production!');
      console.error('   Please set ADMIN_PASSWORD environment variable with a strong password.');
      process.exit(1);
    }

    logger.info('Starting admin reset...', {
      environment: NODE_ENV,
      email: ADMIN_EMAIL,
      forceReset: FORCE_RESET,
    });

    if (NODE_ENV === 'production') {
      console.log('⚠️  WARNING: Running in PRODUCTION mode!');
      console.log('   This will delete ALL existing admin users and admin actions.');
    }

    // First, delete all AdminAction records that reference Admin
    // This is necessary because AdminAction has a foreign key constraint with ON DELETE RESTRICT
    const deletedActions = await prisma.adminAction.deleteMany({});
    logger.info(`Deleted ${deletedActions.count} admin action records`);

    // Delete all existing admins
    const deletedAdmins = await prisma.admin.deleteMany({});
    logger.info(`Deleted ${deletedAdmins.count} admin users`);

    console.log(`\n🗑️  Deleted ${deletedAdmins.count} admin user(s)`);
    if (deletedActions.count > 0) {
      console.log(`   Also deleted ${deletedActions.count} admin action record(s)`);
    }

    // Hash the password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, saltRounds);
    logger.debug('Password hashed successfully');

    // Create the new admin user
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

    console.log('\n✅ Admin reset completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email:    ${admin.email}`);
    console.log(`   Password: ${ADMIN_PASSWORD}${NODE_ENV === 'production' ? ' (set via ADMIN_PASSWORD env)' : ''}`);
    console.log(`   Name:     ${admin.name}`);
    console.log(`   Role:     ${admin.role}`);
    console.log(`   Admin ID: ${admin.id.toString()}`);
    console.log(`   Environment: ${NODE_ENV}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (NODE_ENV === 'production') {
      console.log('⚠️  IMPORTANT: Save these credentials securely!');
      console.log('   The password will not be shown again.\n');
    }
  } catch (error) {
    logger.error('Failed to reset admin user', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    console.error('❌ Failed to reset admin user:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
resetAdmin();

