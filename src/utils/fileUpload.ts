import multer from 'multer';
import path from 'path';
import fs from 'fs';
import type { Request, Response, NextFunction } from 'express';

// Ensure upload directories exist
const uploadDirs = {
  users: path.join(process.cwd(), 'uploads', 'users'),
  'users/profile-pic': path.join(process.cwd(), 'uploads', 'users', 'profile-pic'),
  policies: path.join(process.cwd(), 'uploads', 'policies'),
  nominees: path.join(process.cwd(), 'uploads', 'nominees'),
  banners: path.join(process.cwd(), 'uploads', 'banners'),
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

// File filter for profile pictures - only images
const profilePictureFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images (JPEG, PNG, WebP) are allowed for profile pictures.'));
  }
};

// Configure multer for different upload types
export const uploadUsers = multer({
  storage: createStorage('users'),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 40 
  },
});

export const uploadPolicies = multer({
  storage: createStorage('policies'),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 40, 
  },
});

export const uploadNominees = multer({
  storage: createStorage('nominees'),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 100, 
  },
});

// Profile picture upload - stores in users/profile-pic
export const uploadProfilePicture = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDirs['users/profile-pic']);
    },
    filename: (req, file, cb) => {
      // Generate unique filename: timestamp-randomstring-originalname
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext);
      const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '_');
      cb(null, `${sanitizedName}-${uniqueSuffix}${ext}`);
    },
  }),
  fileFilter: profilePictureFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for profile pictures
    files: 1,
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

export const getFileUrl = (filename: string, uploadType: 'users' | 'policies' | 'nominees' | 'users/profile-pic' | 'banners'): string => {
  const relativePath = `/uploads/${uploadType}/${filename}`;
  const baseUrl = getUploadsBaseUrl();

  return baseUrl ? `${baseUrl}${relativePath}` : relativePath;
};

// Helper function to get profile picture URL
export const getProfilePictureUrl = (filename: string): string => {
  return getFileUrl(filename, 'users/profile-pic');
};

// Helper function to get file path
export const getFilePath = (filename: string, uploadType: 'users' | 'policies' | 'nominees' | 'users/profile-pic' | 'banners'): string => {
  return path.join(uploadDirs[uploadType], filename);
};

// Helper function to delete file
export const deleteFile = (filename: string, uploadType: 'users' | 'policies' | 'nominees' | 'users/profile-pic' | 'banners'): void => {
  const filePath = getFilePath(filename, uploadType);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

// Multiple file upload middleware - allows multiple files up to the configured limit
const createMultipleFileUpload = (uploadInstance: multer.Multer) => {
  return uploadInstance.any();
};

export const multipleUserFileUpload = createMultipleFileUpload(uploadUsers);
export const multiplePolicyFileUpload = createMultipleFileUpload(uploadPolicies);
export const multipleNomineeFileUpload = createMultipleFileUpload(uploadNominees);

// Flexible file upload middleware - supports multiple files, sets req.file to first file for backward compatibility
const createFlexibleFileUpload = (uploadInstance: multer.Multer) => {
  const uploadAny = uploadInstance.any();

  return (req: Request, res: Response, next: NextFunction): void => {
    uploadAny(req, res, (error?: any) => {
      if (error) {
        next(error);
        return;
      }

      const files = (req.files as Express.Multer.File[]) || [];

      // Set req.file to first file for backward compatibility
      if (files.length > 0) {
        req.file = files[0];
      }

      next();
    });
  };
};

// These now support multiple files (up to configured limits)
export const singleUserFileUpload = createFlexibleFileUpload(uploadUsers);
export const singlePolicyFileUpload = createFlexibleFileUpload(uploadPolicies);
export const singleNomineeFileUpload = createFlexibleFileUpload(uploadNominees);

// Profile picture upload middleware
export const singleProfilePictureUpload = createFlexibleFileUpload(uploadProfilePicture);

// Banner upload - stores in banners directory
export const uploadBanner = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDirs['banners']);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext);
      const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '_');
      cb(null, `${sanitizedName}-${uniqueSuffix}${ext}`);
    },
  }),
  fileFilter: profilePictureFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for banners
    files: 1,
  },
});

// Banner upload middleware
export const singleBannerUpload = createFlexibleFileUpload(uploadBanner);

// Helper function to get banner URL
export const getBannerUrl = (filename: string): string => {
  return getFileUrl(filename, 'banners');
};

