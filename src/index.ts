import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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
import path from 'path';
import logger from './config/logger';
import { apiLimiter, authLimiter, adminLimiter, uploadLimiter } from './middlewares/rateLimiter.middleware';
import { requestLogger } from './middlewares/requestLogger.middleware';
import { testDatabaseConnection } from './config/prismaClient';
import { ensureDefaultAdmin } from './config/bootstrap';
import { runDatabaseMigrations } from './config/migrate';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Apply general rate limiting to all routes
app.use(apiLimiter);

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Routes with specific rate limiting
app.use('/auth', authLimiter, authRoutes);
app.use('/admin', authLimiter, adminAuthRoutes);
app.use('/user', userRoutes);
app.use('/policies', policyRoutes);
app.use('/nominees', nomineeRoutes);
app.use('/companies', companyRoutes);
app.use('/policy', policyNomineeRoutes);
app.use('/policy', policyDocumentRoutes);
app.use('/subscription', subscriptionRoutes);

// Test authentication routes (development only)
if (process.env.NODE_ENV !== 'production') {
  app.use('/test-auth', testAuthRoutes);
  logger.info('Test authentication endpoints enabled (development mode)');
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

// Document Routes with upload rate limiting
app.use('/user/document', uploadLimiter, userDocumentRoutes);
app.use('/nominee', uploadLimiter, nomineeDocumentRoutes);
app.use('/policy', uploadLimiter, policyDocumentRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

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
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
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
  logger.info(`Server is running on port ${PORT}`, { port: PORT, env: process.env.NODE_ENV });
  console.log(`🚀 Server is running on port ${PORT}`);
  
  // Test database connection
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
  } else {
    logger.warn('Skipping default admin bootstrap because database connection failed');
  }
});

export default app;

