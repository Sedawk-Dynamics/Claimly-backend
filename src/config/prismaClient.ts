import { PrismaClient } from '@prisma/client';
import logger from './logger';
import { env } from './env';

const prismaClientSingleton = () => {
  // Configure Prisma for production with SSL
  const clientConfig: any = {
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  };

  // In production, ensure database connection uses SSL
  if (env.NODE_ENV === 'production') {
    // Parse DATABASE_URL to check if SSL is configured
    const dbUrl = env.DATABASE_URL;
    
    // Log DATABASE_URL (without password) for debugging
    const urlObj = new URL(dbUrl);
    const safeUrl = `${urlObj.protocol}//${urlObj.username}:***@${urlObj.host}${urlObj.pathname}`;
    logger.info('Database connection configured', {
      host: urlObj.hostname,
      port: urlObj.port,
      database: urlObj.pathname.replace('/', ''),
      hasSSL: dbUrl.includes('sslmode=') || dbUrl.includes('?ssl='),
    });
    
    if (!dbUrl.includes('sslmode=') && !dbUrl.includes('?ssl=')) {
      logger.warn('DATABASE_URL does not include SSL configuration. For Docker/internal networks, SSL may not be required, but adding ?sslmode=prefer is recommended.');
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
    // Try to connect with a timeout
    await Promise.race([
      prisma.$connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
      ),
    ]);
    
    // Test with a simple query
    await prisma.$queryRaw`SELECT 1`;
    
    logger.info('Database connected successfully');
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = (error as any)?.code;
    
    // Parse DATABASE_URL for debugging (without password)
    let dbInfo = 'Unable to parse';
    try {
      const urlObj = new URL(env.DATABASE_URL);
      dbInfo = `${urlObj.protocol}//${urlObj.username}@${urlObj.host}${urlObj.pathname}`;
    } catch {
      // Ignore URL parsing errors
    }
    
    logger.error('Database connection failed', {
      error: errorMessage,
      errorCode,
      databaseUrl: dbInfo,
      host: (() => {
        try {
          return new URL(env.DATABASE_URL).hostname;
        } catch {
          return 'unknown';
        }
      })(),
      port: (() => {
        try {
          return new URL(env.DATABASE_URL).port || '5432';
        } catch {
          return 'unknown';
        }
      })(),
    });
    
    console.error('❌ Database connection failed:', errorMessage);
    console.error('   Database URL:', dbInfo);
    if (errorCode) {
      console.error('   Error Code:', errorCode);
    }
    console.error('   Common fixes:');
    console.error('   1. Verify DATABASE_URL is correct');
    console.error('   2. Check database host is accessible from container');
    console.error('   3. In Docker: use service name or internal network IP');
    console.error('   4. Verify database is running and accepting connections');
    
    return false;
  }
};

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;

