/**
 * Admin Management Script
 * 
 * This script creates or resets admin users in the database.
 * 
 * Modes:
 * 1. CREATE MODE (default): Creates admin if it doesn't exist, fails if exists
 * 2. RESET MODE: Deletes all admins and creates a new one (requires FORCE_RESET=true in production)
 * 
 * Usage:
 *   # Create admin (fails if exists)
 *   npm run admin
 *   OR
 *   npx ts-node scripts/reset-admin.ts
 * 
 *   # Reset all admins and create one
 *   FORCE_RESET=true npm run admin
 * 
 * With environment variables:
 *   ADMIN_EMAIL=admin@claimly.com ADMIN_PASSWORD=admin123 npm run admin
 * 
 * For production reset (requires FORCE_RESET=true):
 *   FORCE_RESET=true ADMIN_EMAIL=admin@claimly.com ADMIN_PASSWORD=secure_password npm run admin
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

async function manageAdmin() {
  try {
    // Warn if using default password in production
    if (NODE_ENV === 'production' && ADMIN_PASSWORD === 'admin123') {
      console.error('❌ ERROR: Cannot use default password "admin123" in production!');
      console.error('   Please set ADMIN_PASSWORD environment variable with a strong password.');
      process.exit(1);
    }

    const isResetMode = FORCE_RESET;

    // Safety check for production reset
    if (NODE_ENV === 'production' && isResetMode) {
      console.log('⚠️  WARNING: Running in PRODUCTION RESET mode!');
      console.log('   This will delete ALL existing admin users and admin actions.');
    }

    logger.info(`Starting admin ${isResetMode ? 'reset' : 'creation'}...`, {
      environment: NODE_ENV,
      email: ADMIN_EMAIL,
      mode: isResetMode ? 'reset' : 'create',
    });

    // RESET MODE: Delete all admins first
    if (isResetMode) {
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
    } else {
      // CREATE MODE: Check if admin already exists
      const existingAdmin = await prisma.admin.findUnique({
        where: { email: ADMIN_EMAIL },
      });

      if (existingAdmin) {
        logger.warn('Admin user already exists', { email: ADMIN_EMAIL, adminId: existingAdmin.id.toString() });
        console.log(`❌ Admin with email ${ADMIN_EMAIL} already exists!`);
        console.log(`   Admin ID: ${existingAdmin.id.toString()}`);
        console.log(`   Role: ${existingAdmin.role}`);
        console.log(`\n   To reset all admins and create a new one, run:`);
        console.log(`   FORCE_RESET=true npm run admin`);
        process.exit(1);
      }
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

    const action = isResetMode ? 'reset' : 'created';
    console.log(`\n✅ Admin ${action} successfully!`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email:    ${admin.email}`);
    console.log(`   Password: ${ADMIN_PASSWORD}${NODE_ENV === 'production' ? ' (set via ADMIN_PASSWORD env)' : ''}`);
    console.log(`   Name:     ${admin.name}`);
    console.log(`   Role:     ${admin.role}`);
    console.log(`   Admin ID: ${admin.id.toString()}`);
    console.log(`   Environment: ${NODE_ENV}`);
    console.log(`   Mode: ${isResetMode ? 'Reset (deleted all admins)' : 'Create (only if not exists)'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (NODE_ENV === 'production') {
      console.log('⚠️  IMPORTANT: Save these credentials securely!');
      console.log('   The password will not be shown again.\n');
    }
  } catch (error) {
    logger.error(`Failed to ${FORCE_RESET ? 'reset' : 'create'} admin user`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    console.error(`❌ Failed to ${FORCE_RESET ? 'reset' : 'create'} admin user:`, error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
manageAdmin();

