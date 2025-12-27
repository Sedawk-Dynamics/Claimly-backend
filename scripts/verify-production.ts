/**
 * Production Verification Script
 * 
 * This script verifies that the production environment is properly configured
 * and that admin scripts can run successfully.
 * 
 * Usage:
 *   npm run verify:production
 *   OR
 *   npx ts-node scripts/verify-production.ts
 */

import dotenv from 'dotenv';
import prisma from '../src/config/prismaClient';
import logger from '../src/config/logger';

dotenv.config();

async function verifyProduction() {
  const errors: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  console.log('🔍 Verifying production environment...\n');

  // Check Node environment
  const nodeEnv = process.env.NODE_ENV || 'development';
  info.push(`NODE_ENV: ${nodeEnv}`);

  // Check database connection
  try {
    await prisma.$connect();
    info.push('✅ Database connection: OK');
    
    // Test query
    await prisma.$queryRaw`SELECT 1`;
    info.push('✅ Database query: OK');
  } catch (error) {
    errors.push(`❌ Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Check required environment variables
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_CLIENT_EMAIL',
  ];

  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      errors.push(`❌ Missing required environment variable: ${varName}`);
    } else {
      info.push(`✅ ${varName}: Set`);
    }
  });

  // Check JWT_SECRET strength
  if (nodeEnv === 'production' && process.env.JWT_SECRET) {
    if (process.env.JWT_SECRET.length < 32) {
      warnings.push('⚠️  JWT_SECRET is less than 32 characters (recommended for production)');
    } else {
      info.push('✅ JWT_SECRET: Strong (32+ characters)');
    }
  }

  // Check Prisma Client
  try {
    // Try to use Prisma Client
    const adminCount = await prisma.admin.count();
    info.push(`✅ Prisma Client: Working (${adminCount} admin(s) found)`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('PrismaClient')) {
      errors.push('❌ Prisma Client not generated. Run: npm run prisma:generate');
    } else {
      errors.push(`❌ Prisma Client error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Check if ts-node is available (for running scripts)
  try {
    const { execSync } = require('child_process');
    execSync('ts-node --version', { stdio: 'ignore' });
    info.push('✅ ts-node: Available');
  } catch {
    warnings.push('⚠️  ts-node not found. Scripts may not work. Install with: npm install -g ts-node typescript');
  }

  // Check admin table exists
  try {
    const admins = await prisma.admin.findMany({ take: 1 });
    info.push('✅ Admin table: Exists');
    
    if (admins.length === 0 && nodeEnv === 'production') {
      warnings.push('⚠️  No admin users found. Create one with: npm run admin');
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not exist')) {
      warnings.push('⚠️  Admin table does not exist. It will be created automatically on first run.');
    } else {
      errors.push(`❌ Admin table check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Print results
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Verification Results:\n');
  
  if (info.length > 0) {
    console.log('✅ Information:');
    info.forEach(msg => console.log(`   ${msg}`));
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('⚠️  Warnings:');
    warnings.forEach(msg => console.log(`   ${msg}`));
    console.log('');
  }

  if (errors.length > 0) {
    console.log('❌ Errors:');
    errors.forEach(msg => console.log(`   ${msg}`));
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (errors.length > 0) {
    console.log('❌ Verification failed. Please fix the errors above.\n');
    logger.error('Production verification failed', { errors, warnings });
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log('⚠️  Verification completed with warnings.\n');
    logger.warn('Production verification completed with warnings', { warnings });
    process.exit(0);
  } else {
    console.log('✅ All checks passed! Production environment is ready.\n');
    logger.info('Production verification passed');
    process.exit(0);
  }
}

// Run verification
verifyProduction().catch((error) => {
  logger.error('Verification script failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
  });
  console.error('❌ Verification script failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});

