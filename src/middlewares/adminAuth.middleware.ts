import { Request, Response, NextFunction } from 'express';
import { verifyAdminToken } from '../utils/adminJwt';

export interface AdminRequest extends Request {
  admin?: {
    adminId: string;
    email: string;
    role: 'SUPER_ADMIN' | 'STAFF' | 'AGENT';
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

// Middleware to ensure the current admin is NOT an agent (for core admin APIs)
export const forbidAgents = (req: AdminRequest, res: Response, next: NextFunction): void => {
  if (!req.admin) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (req.admin.role === 'AGENT') {
    res.status(403).json({ error: 'Forbidden: Agent access not allowed for this resource' });
    return;
  }

  next();
};

// Middleware to ensure an AGENT is verified (for agent‑only APIs)
export const requireVerifiedAgent = async (req: AdminRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!req.admin) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Only agents should go through this check
  if (req.admin.role !== 'AGENT') {
    next();
    return;
  }

  try {
    const prisma = (await import('../config/prismaClient')).default;
    const agent = await prisma.admin.findUnique({
      where: { id: BigInt(req.admin.adminId) },
      select: { is_verified: true },
    });

    if (!agent || !agent.is_verified) {
      res.status(403).json({ 
        error: 'Forbidden: Your agent account is pending verification. Please wait for admin approval.' 
      });
      return;
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  next();
};

