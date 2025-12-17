import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import policyRoutes from './routes/policy.routes';
import nomineeRoutes from './routes/nominee.routes';
import policyNomineeRoutes from './routes/policyNominee.routes';
import policyDocumentRoutes from './routes/policyDocument.routes';
import subscriptionRoutes from './routes/subscription.routes';
import adminAuthRoutes from './routes/adminAuth.routes';
import adminUserRoutes from './routes/adminUser.routes';
import adminAlertRoutes from './routes/adminAlert.routes';
import adminActionRoutes from './routes/adminAction.routes';
import adminCompanyRoutes from './routes/adminCompany.routes';
import adminPolicyRoutes from './routes/adminPolicy.routes';
import adminDocumentRoutes from './routes/adminDocument.routes';
import adminVerifyRoutes from './routes/adminVerify.routes';
import alertRoutes from './routes/alert.routes';
import userDocumentRoutes from './routes/userDocument.routes';
import nomineeDocumentRoutes from './routes/nomineeDocument.routes';
import testAuthRoutes from './routes/testAuth.routes';
import companyRoutes from './routes/company.routes';
import walletRoutes from './routes/wallet.routes';
import notificationRoutes from './routes/notification.routes';
import { notificationService } from './services/notification.service';
import path from 'path';
import logger from './config/logger';
import { env } from './config/env';
import { apiLimiter, authLimiter, adminLimiter, uploadLimiter } from './middlewares/rateLimiter.middleware';
import { requestLogger } from './middlewares/requestLogger.middleware';
import { securityHeaders } from './middlewares/securityHeaders.middleware';
import { testDatabaseConnection } from './config/prismaClient';
import { ensureDefaultAdmin } from './config/bootstrap';
import { ensurePrismaClientGenerated, runDatabaseMigrations } from './config/migrate';
import prisma from './config/prismaClient';

const app = express();
const PORT = env.PORT;

app.set('trust proxy', 1);

// Security headers (must be before other middleware)
app.use(securityHeaders);

// CORS configuration - Allow all origins (for development/testing)
const corsOptions = {
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  optionsSuccessStatus: 200,
};

// Apply CORS middleware (automatically handles OPTIONS preflight requests)
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Apply general rate limiting to all routes
app.use(apiLimiter);

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check endpoint with database status
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      status: 'OK',
      message: 'Server is running',
      database: 'connected',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      cors: {
        allowedOrigins: 'all',
        note: 'All origins are currently allowed',
      },
    });
  } catch (error) {
    logger.error('Health check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(503).json({
      status: 'ERROR',
      message: 'Server is running but database connection failed',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    });
  }
});

// Routes with specific rate limiting
app.use('/auth', authLimiter, authRoutes);
app.use('/admin', authLimiter, adminAuthRoutes);

// Document Routes must come BEFORE parameterized routes to avoid route conflicts
// (e.g., /user/document must come before /user/:id)
app.use('/user/document', uploadLimiter, userDocumentRoutes);
app.use('/nominee', uploadLimiter, nomineeDocumentRoutes);
app.use('/policy', uploadLimiter, policyDocumentRoutes);

// User routes (after specific document routes to avoid conflicts)
app.use('/user', userRoutes);
app.use('/policies', policyRoutes);
app.use('/nominees', nomineeRoutes);
app.use('/companies', companyRoutes);
app.use('/policy', policyNomineeRoutes);
app.use('/policy', policyDocumentRoutes);
app.use('/subscription', subscriptionRoutes);
app.use('/wallet', walletRoutes);
app.use('/', notificationRoutes);

// Test authentication routes
// Enabled by default (set DISABLE_TEST_AUTH=true to disable)
if (!env.DISABLE_TEST_AUTH) {
  app.use('/test-auth', testAuthRoutes);
  logger.info('Test authentication endpoints enabled');
} else {
  logger.info('Test authentication endpoints disabled (DISABLE_TEST_AUTH=true)');
}

// Admin Routes with admin rate limiting
app.use('/admin/users', adminLimiter, adminUserRoutes);
app.use('/admin/alerts', adminLimiter, adminAlertRoutes);
app.use('/admin/actions', adminLimiter, adminActionRoutes);
app.use('/admin/companies', adminLimiter, adminCompanyRoutes);
app.use('/admin/policies', adminLimiter, adminPolicyRoutes);
app.use('/admin/documents', adminLimiter, adminDocumentRoutes);
app.use('/admin', adminLimiter, adminVerifyRoutes);

// Alert Routes
app.use('/alerts', alertRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  // Handle Zod validation errors
  if (err.name === 'ZodError' || (err as any).issues) {
    const zodError = err as any;
    const errors = (zodError.issues || []).map((issue: any) => ({
      path: issue.path?.join('.') || 'unknown',
      message: issue.message || 'Validation error',
    }));
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
    });
    return;
  }

  // Handle multer file upload errors
  if (err.name === 'MulterError') {
    const multerError = err as any;
    if (multerError.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        error: 'File size too large. Maximum size is 10MB.',
      });
      return;
    }
    if (multerError.code === 'LIMIT_UNEXPECTED_FILE') {
      res.status(400).json({
        success: false,
        error: 'Unexpected file input. Upload exactly one file per request.',
      });
      return;
    }
    res.status(400).json({
      success: false,
      error: err.message || 'File upload error',
    });
    return;
  }

  // Handle custom AppError instances
  if ('statusCode' in err && typeof (err as any).statusCode === 'number') {
    const appError = err as any;
    res.status(appError.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // Handle Prisma errors
  if ('code' in err) {
    const prismaError = err as any;
    if (prismaError.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: 'A record with this value already exists',
      });
      return;
    }
    if (prismaError.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: 'Record not found',
      });
      return;
    }
    if (prismaError.code === 'P2003') {
      res.status(400).json({
        success: false,
        error: 'Invalid reference to related record',
      });
      return;
    }
    // Log other Prisma errors for debugging
    logger.error('Prisma error occurred', {
      code: prismaError.code,
      message: prismaError.message,
      meta: prismaError.meta,
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Start server and test database connection
app.listen(PORT, async () => {
  logger.info(`Server is running on port ${PORT}`, { port: PORT, env: env.NODE_ENV, cors: 'all origins allowed' });
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📦 Environment: ${env.NODE_ENV}`);
  console.log(`🌐 CORS: All origins allowed`);
  
  // Test database connection
  try {
    await ensurePrismaClientGenerated();
  } catch (generateError) {
    logger.error('Server startup halted due to Prisma client generation failure', {
      error: generateError instanceof Error ? generateError.message : 'Unknown error',
    });
    return;
  }

  const connected = await testDatabaseConnection();

  if (connected) {
    try {
      await runDatabaseMigrations();
    } catch (migrationError) {
      logger.error('Server startup halted due to migration failure', {
        error: migrationError instanceof Error ? migrationError.message : 'Unknown error',
      });
      return;
    }

    await ensureDefaultAdmin();

    // Start scheduled task to delete old notifications (runs daily at midnight)
    startNotificationCleanupTask();
  } else {
    logger.warn('Skipping default admin bootstrap because database connection failed');
  }
});

/**
 * Start scheduled task to automatically delete notifications older than 1 week
 * Runs once per day at midnight
 */
function startNotificationCleanupTask() {
  const runCleanup = async () => {
    try {
      await notificationService.deleteOldNotifications();
    } catch (error) {
      logger.error('Failed to cleanup old notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // Calculate milliseconds until next midnight
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = midnight.getTime() - now.getTime();

  // Run cleanup at midnight, then every 24 hours
  setTimeout(() => {
    runCleanup();
    setInterval(runCleanup, 24 * 60 * 60 * 1000); // Run every 24 hours
  }, msUntilMidnight);

  logger.info('Notification cleanup task scheduled', {
    firstRun: midnight.toISOString(),
    interval: '24 hours',
  });
}

export default app;

