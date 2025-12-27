import { PrismaClient } from '@prisma/client';
import logger from './logger';
import { env } from './env';

const prismaClientSingleton = () => {
  // Configure Prisma for production with SSL
  const clientConfig: any = {
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  };

  // In production, ensure database connection uses SSL
  if (env.NODE_ENV === 'production') {
    // Parse DATABASE_URL to check if SSL is configured
    const dbUrl = env.DATABASE_URL;
    if (!dbUrl.includes('sslmode=') && !dbUrl.includes('?ssl=')) {
      logger.warn('DATABASE_URL does not include SSL configuration. For production, add ?sslmode=require to your DATABASE_URL');
    }
  }

  return new PrismaClient(clientConfig);
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

// Test database connection
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    logger.error('Database connection failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.error('❌ Database connection failed:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
};

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;

