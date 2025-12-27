import winston from 'winston';
import path from 'path';
import fs from 'fs';

const logDir = path.join(process.cwd(), 'logs');

// Create logs directory if it doesn't exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Helper function to parse size string (e.g., '20m', '100k', '1g') to bytes
function parseSize(sizeStr: string): number {
  const sizeStrLower = sizeStr.toLowerCase().trim();
  const match = sizeStrLower.match(/^(\d+)([kmg]?)$/);
  
  if (!match) {
    // If it's already a number, return it
    const num = parseInt(sizeStr, 10);
    return isNaN(num) ? 20 * 1024 * 1024 : num; // Default to 20MB
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 'k':
      return value * 1024;
    case 'm':
      return value * 1024 * 1024;
    case 'g':
      return value * 1024 * 1024 * 1024;
    default:
      return value; // bytes
  }
}

// Helper function to parse maxFiles (number of files to keep)
function parseMaxFiles(filesStr: string): number {
  const num = parseInt(filesStr, 10);
  return isNaN(num) ? 14 : num; // Default to 14 files
}

// Configure log rotation for production
const maxFilesStr = process.env.LOG_MAX_FILES || '14'; // Number of files to keep
const maxSizeStr = process.env.LOG_MAX_SIZE || '20m'; // Max file size (e.g., '20m' = 20MB)

const maxFiles = parseMaxFiles(maxFilesStr);
const maxSize = parseSize(maxSizeStr);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'claimley-api' },
  transports: [
    // Error logs with rotation
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: maxSize,
      maxFiles: maxFiles,
    }),
    // Combined logs with rotation
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: maxSize,
      maxFiles: maxFiles,
    }),
  ],
});

// Always log errors to console for visibility, even in production
logger.add(
  new winston.transports.Console({
    level: 'error', // Only log errors to console in production
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
          msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
      })
    ),
  })
);

// If we're not in production, also log info/debug to console
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      level: 'info',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
          }
          return msg;
        })
      ),
    })
  );
}

export default logger;

