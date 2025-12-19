import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import policyRoutes from './routes/policy.routes';
import nomineeRoutes from './routes/nominee.routes';
import policyNomineeRoutes from './routes/policyNominee.routes';
import policyDocumentRoutes from './routes/policyDocument.routes';
import subscriptionRoutes from './routes/subscription.routes';
import paymentRoutes from './routes/payment.routes';
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
import fs from 'fs';
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

// Serve static files from uploads directory (before rate limiting to allow file access)
const uploadsPath = path.join(process.cwd(), 'uploads');

// Log all /uploads requests for debugging
app.use('/uploads', (req, res, next) => {
  logger.info('File request received', {
    method: req.method,
    url: req.url,
    path: req.path,
    originalUrl: req.originalUrl,
    query: req.query,
    uploadsPath,
    cwd: process.cwd(),
  });
  next();
});

// Check if uploads directory exists
if (!fs.existsSync(uploadsPath)) {
  logger.warn('Uploads directory does not exist, creating it', { uploadsPath });
  fs.mkdirSync(uploadsPath, { recursive: true });
}

// Log uploads directory structure
try {
  if (fs.existsSync(uploadsPath)) {
    const uploadsContents = fs.readdirSync(uploadsPath);
    logger.info('Uploads directory contents', {
      uploadsPath,
      contents: uploadsContents,
    });
    
    // Log subdirectories
    ['users', 'policies', 'nominees'].forEach((subdir) => {
      const subdirPath = path.join(uploadsPath, subdir);
      if (fs.existsSync(subdirPath)) {
        const files = fs.readdirSync(subdirPath);
        logger.info(`Uploads/${subdir} directory contents`, {
          path: subdirPath,
          fileCount: files.length,
          files: files.slice(0, 10), // Log first 10 files
        });
      } else {
        logger.warn(`Uploads/${subdir} directory does not exist`, { path: subdirPath });
      }
    });
  }
} catch (error) {
  logger.error('Error reading uploads directory', {
    error: error instanceof Error ? error.message : 'Unknown error',
    uploadsPath,
  });
}

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadsPath, {
  setHeaders: (res, filePath) => {
    // Set appropriate headers for file serving
    res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    logger.debug('Serving static file', { filePath });
  },
  fallthrough: true, // Allow request to continue to next handler if file not found
}));

// Route handler for uploaded files with proper error handling
app.get('/uploads/:type/:filename', (req, res, next) => {
  const { type, filename } = req.params;
  
  logger.info('Route handler called for file request', {
    type,
    filename,
    originalFilename: filename,
    url: req.url,
    path: req.path,
  });
  
  // Validate type to prevent directory traversal
  const allowedTypes = ['users', 'policies', 'nominees'];
  if (!allowedTypes.includes(type)) {
    logger.warn('Invalid upload type requested', { type, filename });
    return res.status(400).json({
      success: false,
      error: 'Invalid upload type',
    });
  }
  
  // Sanitize filename to prevent directory traversal
  const sanitizedFilename = path.basename(filename);
  if (sanitizedFilename !== filename || filename.includes('..')) {
    logger.warn('Invalid filename detected (directory traversal attempt?)', {
      original: filename,
      sanitized: sanitizedFilename,
    });
    return res.status(400).json({
      success: false,
      error: 'Invalid filename',
    });
  }
  
  const filePath = path.join(uploadsPath, type, sanitizedFilename);
  const normalizedPath = path.normalize(filePath);
  
  logger.info('Checking file existence', {
    type,
    filename,
    sanitizedFilename,
    filePath,
    normalizedPath,
    uploadsPath,
    cwd: process.cwd(),
  });
  
  // First, try exact match
  let actualFilePath = normalizedPath;
  let fileExists = fs.existsSync(normalizedPath);
  
  // If not found, try case-insensitive lookup
  if (!fileExists) {
    const typeDir = path.join(uploadsPath, type);
    if (fs.existsSync(typeDir)) {
      try {
        const dirContents = fs.readdirSync(typeDir);
        const filenameLower = sanitizedFilename.toLowerCase();
        const foundFile = dirContents.find(file => file.toLowerCase() === filenameLower);
        
        if (foundFile) {
          actualFilePath = path.join(typeDir, foundFile);
          fileExists = true;
          logger.info('Found file with case-insensitive match', {
            requested: sanitizedFilename,
            found: foundFile,
            actualPath: actualFilePath,
          });
        }
      } catch (err) {
        logger.error('Error during case-insensitive lookup', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  }
  
  // Check if file exists
  if (!fileExists) {
    // List files in the directory for debugging
    const typeDir = path.join(uploadsPath, type);
    let dirContents: string[] = [];
    let foundSimilar: string | null = null;
    
    try {
      if (fs.existsSync(typeDir)) {
        dirContents = fs.readdirSync(typeDir);
        
        // Try to find a similar filename (case-insensitive or partial match)
        const filenameLower = sanitizedFilename.toLowerCase();
        foundSimilar = dirContents.find(file => 
          file.toLowerCase() === filenameLower ||
          file.toLowerCase().includes(filenameLower) ||
          filenameLower.includes(file.toLowerCase())
        ) || null;
        
        logger.warn('File not found - listing directory contents', {
          filePath: normalizedPath,
          type,
          filename,
          sanitizedFilename,
          directory: typeDir,
          directoryExists: true,
          filesInDirectory: dirContents.slice(0, 50), // Log first 50 files
          totalFiles: dirContents.length,
          foundSimilarFile: foundSimilar,
          requestedFilenameLower: filenameLower,
          allFilesLower: dirContents.map(f => f.toLowerCase()).slice(0, 20),
        });
        
        // If we found a similar file, log it prominently
        if (foundSimilar) {
          logger.warn('Found similar filename - possible case sensitivity or naming mismatch', {
            requested: sanitizedFilename,
            found: foundSimilar,
            requestedLower: filenameLower,
            foundLower: foundSimilar.toLowerCase(),
            match: filenameLower === foundSimilar.toLowerCase() ? 'exact (case mismatch)' : 'partial',
          });
        }
      } else {
        logger.warn('File not found - directory does not exist', {
          filePath: normalizedPath,
          type,
          filename,
          sanitizedFilename,
          directory: typeDir,
          directoryExists: false,
        });
      }
    } catch (dirError) {
      logger.error('Error reading directory', {
        error: dirError instanceof Error ? dirError.message : 'Unknown error',
        directory: typeDir,
      });
    }
    
    // Return detailed error with suggestions
    const errorResponse: any = {
      success: false,
      error: 'File not found',
      details: {
        requestedFile: filename,
        sanitizedFile: sanitizedFilename,
        type,
        path: normalizedPath,
        directory: typeDir,
        directoryExists: fs.existsSync(typeDir),
        totalFilesInDirectory: dirContents.length,
      },
    };
    
    if (foundSimilar) {
      errorResponse.suggestion = `Found similar filename: ${foundSimilar}. This might be a case sensitivity issue or filename mismatch.`;
      errorResponse.foundSimilarFile = foundSimilar;
    }
    
    return res.status(404).json(errorResponse);
  }
  
  // Check if it's a file (not a directory)
  let stats: fs.Stats;
  try {
    stats = fs.statSync(actualFilePath);
  } catch (statError) {
    logger.error('Error getting file stats', {
      error: statError instanceof Error ? statError.message : 'Unknown error',
      filePath: actualFilePath,
      normalizedPath,
    });
    return res.status(500).json({
      success: false,
      error: 'Error accessing file',
    });
  }
  
  if (!stats.isFile()) {
    logger.warn('Path is not a file', {
      filePath: actualFilePath,
      normalizedPath,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
    });
    return res.status(400).json({
      success: false,
      error: 'Invalid file path',
    });
  }
  
  logger.info('Serving file', {
    filePath: actualFilePath,
    normalizedPath,
    filename,
    size: stats.size,
    type,
  });
  
  // Send the file
  res.sendFile(actualFilePath, (err) => {
    if (err) {
      logger.error('Error sending file', {
        error: err.message,
        stack: err.stack,
        filePath: actualFilePath,
        normalizedPath,
        filename,
        type,
        headersSent: res.headersSent,
      });
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Error serving file',
        });
      }
    } else {
      logger.info('File served successfully', {
        filePath: actualFilePath,
        normalizedPath,
        filename,
        type,
      });
    }
  });
});

// Apply general rate limiting to all routes (after static files)
app.use(apiLimiter);

// Diagnostic endpoint for uploads directory
app.get('/diagnostics/uploads', (req, res) => {
  try {
    const diagnostics: any = {
      uploadsPath,
      cwd: process.cwd(),
      uploadsExists: fs.existsSync(uploadsPath),
      directories: {},
    };
    
    ['users', 'policies', 'nominees'].forEach((type) => {
      const typeDir = path.join(uploadsPath, type);
      const exists = fs.existsSync(typeDir);
      diagnostics.directories[type] = {
        path: typeDir,
        exists,
        fileCount: 0,
        files: [],
      };
      
      if (exists) {
        try {
          const files = fs.readdirSync(typeDir);
          diagnostics.directories[type].fileCount = files.length;
          diagnostics.directories[type].files = files.slice(0, 50); // First 50 files
        } catch (err) {
          diagnostics.directories[type].error = err instanceof Error ? err.message : 'Unknown error';
        }
      }
    });
    
    res.json({
      success: true,
      diagnostics,
    });
  } catch (error) {
    logger.error('Error generating uploads diagnostics', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({
      success: false,
      error: 'Error generating diagnostics',
    });
  }
});

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
app.use('/payment', paymentRoutes);
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
    logger.error('Validation error', {
      errors,
      path: req.path,
      method: req.method,
      body: req.body,
    });
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
  // In production, still log the error message for debugging but don't expose it to client
  const errorMessage = err.message || 'Unknown error';
  logger.error('Unhandled error', {
    message: errorMessage,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: env.NODE_ENV === 'development' ? errorMessage : 'An unexpected error occurred. Please try again.',
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  // Log 404 requests, especially for /uploads paths
  if (req.path.startsWith('/uploads')) {
    logger.warn('404 - Uploads route not found', {
      method: req.method,
      url: req.url,
      path: req.path,
      originalUrl: req.originalUrl,
      query: req.query,
      headers: {
        'user-agent': req.headers['user-agent'],
        'referer': req.headers.referer,
      },
      uploadsPath,
      cwd: process.cwd(),
    });
  } else {
    logger.debug('404 - Route not found', {
      method: req.method,
      url: req.url,
      path: req.path,
    });
  }
  
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
    console.error('❌ Prisma client generation failed');
    return;
  }

  // Check Firebase initialization
  try {
    const admin = await import('./config/firebase');
    if (!admin.default.apps.length) {
      logger.error('Firebase Admin SDK not initialized');
      console.error('❌ Firebase Admin SDK not initialized. Authentication will fail!');
      console.error('Please check FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL environment variables.');
    } else {
      logger.info('Firebase Admin SDK initialized successfully');
      console.log('✅ Firebase Admin SDK initialized');
    }
  } catch (firebaseError) {
    logger.error('Firebase initialization check failed', {
      error: firebaseError instanceof Error ? firebaseError.message : 'Unknown error',
    });
    console.error('❌ Firebase initialization check failed:', firebaseError instanceof Error ? firebaseError.message : 'Unknown error');
  }

  const connected = await testDatabaseConnection();

  if (connected) {
    try {
      await runDatabaseMigrations();
    } catch (migrationError) {
      logger.error('Server startup halted due to migration failure', {
        error: migrationError instanceof Error ? migrationError.message : 'Unknown error',
      });
      console.error('❌ Database migration failed');
      return;
    }

    await ensureDefaultAdmin();

    // Start scheduled task to delete old notifications (runs daily at midnight)
    startNotificationCleanupTask();
  } else {
    logger.warn('Skipping default admin bootstrap because database connection failed');
    console.warn('⚠️  Database connection failed');
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

