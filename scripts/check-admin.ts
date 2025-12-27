/**
 * Admin Check Script
 * 
 * This script checks if admin users exist in the database and displays their information.
 * 
 * Usage:
 *   npm run check:admin
 *   OR
 *   npx ts-node scripts/check-admin.ts
 * 
 * With environment variables:
 *   ADMIN_EMAIL=admin@claimly.com npm run check:admin
 */

import dotenv from 'dotenv';
import prisma from '../src/config/prismaClient';
import logger from '../src/config/logger';

dotenv.config();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

async function checkAdmin() {
  try {
    console.log('🔍 Checking admin users...\n');

    // Get all admins
    const admins = await prisma.admin.findMany({
      orderBy: { created_at: 'desc' },
    });

    if (admins.length === 0) {
      console.log('❌ No admin users found in the database.\n');
      console.log('   To create an admin, run:');
      console.log('   npm run admin');
      console.log('   OR');
      console.log('   ADMIN_EMAIL=admin@claimly.com ADMIN_PASSWORD=your_password npm run admin\n');
      process.exit(0);
    }

    console.log(`✅ Found ${admins.length} admin user(s):\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    admins.forEach((admin, index) => {
      console.log(`\n${index + 1}. Admin User:`);
      console.log(`   ID:       ${admin.id.toString()}`);
      console.log(`   Email:    ${admin.email}`);
      console.log(`   Name:     ${admin.name}`);
      console.log(`   Role:     ${admin.role}`);
      console.log(`   Created:  ${admin.created_at.toISOString()}`);
      console.log(`   Updated:  ${admin.updated_at.toISOString()}`);
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // If specific email provided, check if it exists
    if (ADMIN_EMAIL) {
      const specificAdmin = admins.find(a => a.email === ADMIN_EMAIL);
      if (specificAdmin) {
        console.log(`✅ Admin with email "${ADMIN_EMAIL}" exists.`);
        logger.info('Admin check completed', {
          email: ADMIN_EMAIL,
          adminId: specificAdmin.id.toString(),
          found: true,
        });
      } else {
        console.log(`❌ Admin with email "${ADMIN_EMAIL}" not found.`);
        logger.info('Admin check completed', {
          email: ADMIN_EMAIL,
          found: false,
        });
        process.exit(1);
      }
    } else {
      logger.info('Admin check completed', {
        totalAdmins: admins.length,
      });
    }
  } catch (error) {
    logger.error('Failed to check admin users', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    console.error('❌ Failed to check admin users:', error instanceof Error ? error.message : 'Unknown error');
    
    // Check if it's a database connection error
    if (error instanceof Error && error.message.includes('connect')) {
      console.error('\n💡 Tip: Make sure the database is running and DATABASE_URL is correct.');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
checkAdmin();

