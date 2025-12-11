import multer from 'multer';
import path from 'path';
import fs from 'fs';
import type { Request, Response, NextFunction } from 'express';

// Ensure upload directories exist
const uploadDirs = {
  users: path.join(process.cwd(), 'uploads', 'users'),
  policies: path.join(process.cwd(), 'uploads', 'policies'),
  nominees: path.join(process.cwd(), 'uploads', 'nominees'),
};

Object.values(uploadDirs).forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Create storage factory for different upload types
const createStorage = (uploadType: 'users' | 'policies' | 'nominees') => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDirs[uploadType]);
    },
    filename: (req, file, cb) => {
      // Generate unique filename: timestamp-randomstring-originalname
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext);
      const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '_');
      cb(null, `${sanitizedName}-${uniqueSuffix}${ext}`);
    },
  });
};

// File filter - accept common document types
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, images, and Word documents are allowed.'));
  }
};

// Configure multer for different upload types
export const uploadUsers = multer({
  storage: createStorage('users'),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1,
  },
});

export const uploadPolicies = multer({
  storage: createStorage('policies'),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1,
  },
});

export const uploadNominees = multer({
  storage: createStorage('nominees'),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 10, // Allow up to 10 files for update operations
  },
});

// Default export for backward compatibility
export const upload = uploadUsers;

// Helper function to get file URL
const getUploadsBaseUrl = (): string | null => {
  const baseUrl =
    process.env.FILE_BASE_URL ||
    process.env.API_BASE_URL ||
    process.env.APP_BASE_URL ||
    process.env.APP_URL ||
    process.env.SERVER_BASE_URL ||
    '';

  if (!baseUrl) {
    return null;
  }

  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
};

export const getFileUrl = (filename: string, uploadType: 'users' | 'policies' | 'nominees'): string => {
  const relativePath = `/uploads/${uploadType}/${filename}`;
  const baseUrl = getUploadsBaseUrl();

  return baseUrl ? `${baseUrl}${relativePath}` : relativePath;
};

// Helper function to get file path
export const getFilePath = (filename: string, uploadType: 'users' | 'policies' | 'nominees'): string => {
  return path.join(uploadDirs[uploadType], filename);
};

// Helper function to delete file
export const deleteFile = (filename: string, uploadType: 'users' | 'policies' | 'nominees'): void => {
  const filePath = getFilePath(filename, uploadType);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

const createFlexibleSingleFileUpload = (uploadInstance: multer.Multer) => {
  const uploadAny = uploadInstance.any();

  return (req: Request, res: Response, next: NextFunction): void => {
    uploadAny(req, res, (error?: any) => {
      if (error) {
        next(error);
        return;
      }

      const files = (req.files as Express.Multer.File[]) || [];

      if (files.length > 1) {
        const multerError = new multer.MulterError('LIMIT_UNEXPECTED_FILE', files[1].fieldname);
        multerError.message = 'Only one file can be uploaded per request.';
        next(multerError);
        return;
      }

      if (files.length === 1) {
        req.file = files[0];
      }

      next();
    });
  };
};

export const singleUserFileUpload = createFlexibleSingleFileUpload(uploadUsers);
export const singlePolicyFileUpload = createFlexibleSingleFileUpload(uploadPolicies);
export const singleNomineeFileUpload = createFlexibleSingleFileUpload(uploadNominees);

// Multiple file upload middleware for nominees (used in update operations)
export const multipleNomineeFileUpload = uploadNominees.any();

