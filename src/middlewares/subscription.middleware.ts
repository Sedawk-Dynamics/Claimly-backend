import { Response, NextFunction } from 'express';
import prisma from '../config/prismaClient';
import logger from '../config/logger';
import { AuthRequest } from './auth.middleware';
import { getUserKycStatus } from '../services/user.service';

export const requireActiveSubscription = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: BigInt(req.user.userId) },
      select: { subscription_status: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.subscription_status !== 'ACTIVE') {
      logger.warn('Active subscription required', {
        userId: req.user.userId,
        subscriptionStatus: user.subscription_status,
      });
      res.status(403).json({ error: 'Active subscription required' });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const requireCompletedKyc = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const kycStatus = await getUserKycStatus(req.user.userId);

    if (kycStatus.status !== 'COMPLETED') {
      logger.warn('KYC verification required', {
        userId: req.user.userId,
        missingDocuments: kycStatus.missingDocuments,
      });
      res.status(403).json({
        error: 'KYC verification is required',
        details: kycStatus,
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};


