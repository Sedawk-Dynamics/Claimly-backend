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
  
  return {
    DATABASE_URL: process.env.DATABASE_URL!,
    JWT_SECRET: process.env.JWT_SECRET!,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID!,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY!,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL!,
    PORT: parseInt(process.env.PORT || '3000', 10),
    NODE_ENV: nodeEnv,
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5175,http://localhost:5173',
    DISABLE_TEST_AUTH: process.env.DISABLE_TEST_AUTH === 'true',
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

