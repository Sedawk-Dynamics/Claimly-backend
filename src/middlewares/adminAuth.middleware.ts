import { Request, Response, NextFunction } from 'express';
import { verifyAdminToken } from '../utils/adminJwt';

export interface AdminRequest extends Request {
  admin?: {
    adminId: string;
    email: string;
    role: 'SUPER_ADMIN' | 'STAFF';
  };
}

export const authenticateAdmin = (req: AdminRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: No token provided' });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = verifyAdminToken(token);

    req.admin = {
      adminId: decoded.adminId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

export const requireSuperAdmin = (req: AdminRequest, res: Response, next: NextFunction): void => {
  if (!req.admin) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (req.admin.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Forbidden: Super admin access required' });
    return;
  }

  next();
};

