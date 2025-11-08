import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

export interface AdminJWTPayload {
  adminId: string;
  email: string;
  role: 'SUPER_ADMIN' | 'STAFF';
}

export const generateAdminToken = (payload: AdminJWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '8h', // Admin tokens expire in 8 hours
  });
};

export const verifyAdminToken = (token: string): AdminJWTPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as AdminJWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

