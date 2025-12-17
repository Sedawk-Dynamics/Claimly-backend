import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { createSubscription } from '../services/subscription.service';

export const createSubscriptionController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { planName, amount, paymentId, paymentStatus, transactionDate, walletAmountUsed } = req.body;

    // Use authenticated user's ID
    const subscription = await createSubscription({
      userId: req.user.userId,
      planName,
      amount,
      paymentId,
      paymentStatus: paymentStatus || 'PENDING',
      transactionDate,
      walletAmountUsed: walletAmountUsed ? walletAmountUsed.toString() : undefined,
    });

    res.status(201).json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

