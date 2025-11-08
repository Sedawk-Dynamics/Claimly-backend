import bcrypt from 'bcrypt';
import prisma from '../config/prismaClient';
import { generateAdminToken } from '../utils/adminJwt';
import { UnauthorizedError } from '../utils/errors';
import logger from '../config/logger';

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  token: string;
  admin: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export const adminLogin = async (data: AdminLoginRequest): Promise<AdminLoginResponse> => {
  logger.info('Admin login attempt', { email: data.email });
  
  // Find admin by email
  const admin = await prisma.admin.findUnique({
    where: { email: data.email },
  });

  if (!admin) {
    logger.warn('Admin login failed: user not found', { email: data.email });
    throw new UnauthorizedError('Invalid email or password');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(data.password, admin.password_hash);

  if (!isPasswordValid) {
    logger.warn('Admin login failed: invalid password', { email: data.email, adminId: admin.id.toString() });
    throw new UnauthorizedError('Invalid email or password');
  }

  logger.info('Admin authenticated successfully', { adminId: admin.id.toString(), email: admin.email });

  // Generate JWT token
  const token = generateAdminToken({
    adminId: admin.id.toString(),
    email: admin.email,
    role: admin.role,
  });

  return {
    token,
    admin: {
      id: admin.id.toString(),
      name: admin.name,
      email: admin.email,
      role: admin.role,
    },
  };
};

