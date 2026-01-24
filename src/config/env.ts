import dotenv from 'dotenv';
import logger from './logger';

dotenv.config();

interface EnvConfig {
  // Database
  DATABASE_URL: string;
  
  // JWT
  JWT_SECRET: string;
  
  // Firebase
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
  
  // Server
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  LOG_LEVEL: string;
  
  // CORS
  CORS_ORIGIN: string;
  
  // Security
  DISABLE_TEST_AUTH: boolean;
  
  // Razorpay (Android / Web)
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;

  // Apple In-App Purchase (iOS) – second payment option alongside Razorpay
  APPLE_IAP_SHARED_SECRET: string;
  APPLE_IAP_USE_SANDBOX: boolean;
  /** Expected iOS bundle id (recommended in production). Example: "com.yourcompany.yourapp" */
  APPLE_IAP_BUNDLE_ID: string;
  /** Optional JSON: {"com.yourapp.premium":"Premium Plan"} – maps Apple product_id to plan name */
  APPLE_IAP_PRODUCT_PLAN_MAP: Record<string, string>;
  /**
   * Optional App Apple ID (numeric) used for App Store Server Notifications verification in production.
   * Example: 1234567890
   */
  APPLE_IAP_APP_APPLE_ID?: number;
}

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
] as const;

function validateEnv(): EnvConfig {
  const missingVars: string[] = [];
  
  // Check required variables
  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }
  
  if (missingVars.length > 0) {
    const errorMsg = `Missing required environment variables: ${missingVars.join(', ')}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }
  
  // Validate NODE_ENV
  const nodeEnv = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test';
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    logger.warn(`Invalid NODE_ENV: ${nodeEnv}, defaulting to development`);
  }
  
  // Validate JWT_SECRET strength in production
  if (nodeEnv === 'production' && process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    logger.warn('JWT_SECRET is too short for production. Use at least 32 characters.');
  }

  // Validate Razorpay configuration (warn if missing in production, but don't fail)
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
  
  if (nodeEnv === 'production') {
    if (!razorpayKeyId || !razorpayKeySecret) {
      logger.warn('Razorpay keys are not configured. Payment features may not work correctly.');
    } else if (razorpayKeyId.length < 10 || razorpayKeySecret.length < 10) {
      logger.warn('Razorpay keys appear to be invalid. Please verify your configuration.');
    }
  }

  // Apple IAP (optional – required only for iOS in-app purchase)
  const appleIapSharedSecret = process.env.APPLE_IAP_SHARED_SECRET || '';
  const appleIapUseSandbox = process.env.APPLE_IAP_USE_SANDBOX === 'true';
  const appleIapBundleId = (process.env.APPLE_IAP_BUNDLE_ID || '').trim();
  let appleIapProductPlanMap: Record<string, string> = {};
  const mapRaw = process.env.APPLE_IAP_PRODUCT_PLAN_MAP || '';
  if (mapRaw.trim()) {
    try {
      appleIapProductPlanMap = JSON.parse(mapRaw) as Record<string, string>;
    } catch {
      logger.warn('APPLE_IAP_PRODUCT_PLAN_MAP is not valid JSON. Apple IAP product–plan validation will be skipped.');
    }
  }
  if (nodeEnv === 'production' && !appleIapSharedSecret) {
    logger.warn('APPLE_IAP_SHARED_SECRET is not set. Apple In-App Purchase (iOS) features will not work.');
  }
  if (nodeEnv === 'production' && !appleIapBundleId) {
    logger.warn(
      'APPLE_IAP_BUNDLE_ID is not set. Apple receipt bundle_id verification will be skipped (NOT recommended for production).'
    );
  }
  const appleIapAppAppleIdRaw = (process.env.APPLE_IAP_APP_APPLE_ID || '').trim();
  const appleIapAppAppleId =
    appleIapAppAppleIdRaw && !Number.isNaN(Number(appleIapAppAppleIdRaw))
      ? Number(appleIapAppAppleIdRaw)
      : undefined;

  // CORS is now open to all origins (web and mobile apps)
  // No validation needed as all origins are allowed

  // Validate and fix DATABASE_URL
  let databaseUrl = process.env.DATABASE_URL!;
  databaseUrl = databaseUrl.trim();
  // Support values wrapped in quotes (common in some dashboards)
  if (
    (databaseUrl.startsWith('"') && databaseUrl.endsWith('"')) ||
    (databaseUrl.startsWith("'") && databaseUrl.endsWith("'"))
  ) {
    databaseUrl = databaseUrl.slice(1, -1);
  }
  
  // Parse DATABASE_URL (and normalize port)
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch (urlError) {
    logger.error('Invalid DATABASE_URL format', {
      error: urlError instanceof Error ? urlError.message : 'Unknown error',
    });
    console.error('❌ ERROR: DATABASE_URL format is invalid');
    console.error('   Expected format: postgresql://user:password@host:port/database');
    throw new Error(
      urlError instanceof Error ? urlError.message : 'Invalid DATABASE_URL format'
    );
  }

  // If no port specified, add PostgreSQL default port
  if (!url.port) {
    url.port = '5432';
    databaseUrl = url.toString();
    logger.warn('DATABASE_URL missing port, defaulting to 5432 (PostgreSQL)');
  }

  // If MySQL port detected, block startup (prevents connecting to wrong DB)
  if (url.port === '3306') {
    logger.error('DATABASE_URL uses port 3306 (MySQL). PostgreSQL uses port 5432. Please update your DATABASE_URL.');
    console.error('❌ ERROR: DATABASE_URL uses MySQL port (3306). PostgreSQL requires port 5432.');
    console.error('   Current URL:', databaseUrl.replace(/:[^:@]+@/, ':***@')); // Mask password
    console.error('   Fix: Update DATABASE_URL to use port 5432');
    throw new Error('DATABASE_URL must not use port 3306 (MySQL). Use 5432 for PostgreSQL.');
  }

  // Validate it's a PostgreSQL URL
  if (!url.protocol.includes('postgres')) {
    logger.error('DATABASE_URL protocol is not PostgreSQL. Expected postgresql:// or postgres://');
    console.error('❌ ERROR: DATABASE_URL must use postgresql:// or postgres:// protocol');
    throw new Error('DATABASE_URL must use postgresql:// or postgres:// protocol');
  }

  // Ensure the normalized URL is used everywhere (including Prisma CLI subprocesses)
  process.env.DATABASE_URL = databaseUrl;

  return {
    DATABASE_URL: databaseUrl,
    JWT_SECRET: process.env.JWT_SECRET!,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID!,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY!,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL!,
    PORT: parseInt(process.env.PORT || '3000', 10),
    NODE_ENV: nodeEnv,
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5175,http://localhost:5173',
    DISABLE_TEST_AUTH: process.env.DISABLE_TEST_AUTH === 'true',
    RAZORPAY_KEY_ID: razorpayKeyId,
    RAZORPAY_KEY_SECRET: razorpayKeySecret,
    APPLE_IAP_SHARED_SECRET: appleIapSharedSecret,
    APPLE_IAP_USE_SANDBOX: appleIapUseSandbox,
    APPLE_IAP_BUNDLE_ID: appleIapBundleId,
    APPLE_IAP_PRODUCT_PLAN_MAP: appleIapProductPlanMap,
    APPLE_IAP_APP_APPLE_ID: appleIapAppAppleId,
  };
}

export const env = validateEnv();

// Log environment info (without sensitive data)
if (env.NODE_ENV === 'production') {
  logger.info('Production environment detected', {
    port: env.PORT,
    corsOrigins: env.CORS_ORIGIN.split(',').length,
    testAuthDisabled: env.DISABLE_TEST_AUTH,
  });
}

