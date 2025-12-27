import { PrismaClient } from '@prisma/client';
import logger from './logger';
import { env } from './env';

const prismaClientSingleton = () => {
  // CRITICAL: Force Prisma to use runtime DATABASE_URL from environment
  // This ensures Prisma doesn't use a cached/compiled connection string
  const databaseUrl = process.env.DATABASE_URL || env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Parse and validate DATABASE_URL
  let urlObj: URL;
  try {
    urlObj = new URL(databaseUrl);
  } catch (error) {
    logger.error('Invalid DATABASE_URL format', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new Error('Invalid DATABASE_URL format');
  }

  // Log connection details (without password)
  const safeUrl = `${urlObj.protocol}//${urlObj.username}:***@${urlObj.host}${urlObj.pathname}`;
  logger.info('Initializing Prisma Client with DATABASE_URL', {
    host: urlObj.hostname,
    port: urlObj.port || '5432 (default)',
    database: urlObj.pathname.replace('/', ''),
    protocol: urlObj.protocol,
    safeUrl,
  });
  console.log('🔌 Prisma Client connecting to:', safeUrl);

  // Validate port
  const port = urlObj.port || '5432';
  if (port === '3306') {
    logger.error('DATABASE_URL uses MySQL port (3306). PostgreSQL requires port 5432.');
    console.error('❌ ERROR: DATABASE_URL uses port 3306 (MySQL). PostgreSQL uses port 5432.');
    throw new Error('DATABASE_URL must use port 5432 for PostgreSQL, not 3306');
  }

  // Configure Prisma Client - explicitly set DATABASE_URL
  const clientConfig: any = {
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: databaseUrl, // Use runtime DATABASE_URL, not compiled one
      },
    },
  };

  // In production, ensure database connection uses SSL
  if (env.NODE_ENV === 'production') {
    if (!databaseUrl.includes('sslmode=') && !databaseUrl.includes('?ssl=')) {
      logger.warn('DATABASE_URL does not include SSL configuration. For Docker/internal networks, SSL may not be required.');
    }
  }

  // Create Prisma Client with explicit DATABASE_URL
  const prisma = new PrismaClient(clientConfig);
  
  // Override the connection URL at runtime to ensure it uses the correct one
  // This is a workaround for Prisma Client caching issues
  if (prisma && (prisma as any).$connect) {
    // Store the URL for verification
    (prisma as any).__databaseUrl = safeUrl;
  }

  return prisma;
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

// In production, always create a new instance to ensure fresh DATABASE_URL
// In development, reuse the global instance for hot reload
const prisma = (env.NODE_ENV === 'production') 
  ? prismaClientSingleton() 
  : (globalThis.prismaGlobal ?? prismaClientSingleton());

// Test database connection
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    // Log what URL we're trying to connect to
    const currentUrl = process.env.DATABASE_URL || env.DATABASE_URL;
    let urlInfo = 'unknown';
    try {
      const url = new URL(currentUrl);
      urlInfo = `${url.protocol}//${url.username}@${url.hostname}:${url.port || '5432'}${url.pathname}`;
    } catch {
      urlInfo = 'invalid URL';
    }
    
    logger.info('Attempting database connection', {
      url: urlInfo,
      hostname: (() => {
        try {
          return new URL(currentUrl).hostname;
        } catch {
          return 'unknown';
        }
      })(),
      port: (() => {
        try {
          return new URL(currentUrl).port || '5432';
        } catch {
          return 'unknown';
        }
      })(),
    });
    console.log('🔌 Attempting to connect to:', urlInfo);
    
    // Disconnect any existing connection first
    try {
      await prisma.$disconnect();
    } catch {
      // Ignore disconnect errors
    }
    
    // Try to connect with a timeout
    await Promise.race([
      prisma.$connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
      ),
    ]);
    
    // Test with a simple query
    await prisma.$queryRaw`SELECT 1`;
    
    logger.info('Database connected successfully', {
      url: urlInfo,
    });
    console.log('✅ Database connected successfully to:', urlInfo);
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

