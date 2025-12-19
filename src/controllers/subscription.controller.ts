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
    // Handle walletAmountUsed: convert to string if provided, undefined if not provided or 0
    let walletAmountUsedStr: string | undefined;
    
    // Handle different input types: string, number, or undefined/null
    if (walletAmountUsed !== undefined && walletAmountUsed !== null) {
      // Convert to string first, then parse
      const walletAmountStr = String(walletAmountUsed).trim();
      
      // Only process if not empty string
      if (walletAmountStr !== '') {
        const walletAmount = parseFloat(walletAmountStr);
        
        // Validate the parsed amount
        if (!isNaN(walletAmount) && walletAmount > 0) {
          walletAmountUsedStr = walletAmount.toString();
        } else if (!isNaN(walletAmount) && walletAmount === 0) {
          // Explicitly set to undefined if 0 (no wallet usage)
          walletAmountUsedStr = undefined;
        } else {
          // Invalid value - log warning but don't fail, just don't use wallet
          console.warn('Invalid walletAmountUsed value:', walletAmountUsed, 'treating as no wallet usage');
          walletAmountUsedStr = undefined;
        }
      }
    }

    // Log for debugging
    console.log('Subscription controller received:', {
      walletAmountUsed,
      walletAmountUsedType: typeof walletAmountUsed,
      walletAmountUsedStr,
      planName,
      amount,
    });

    const subscription = await createSubscription({
      userId: req.user.userId,
      planName,
      amount,
      paymentId,
      paymentStatus: paymentStatus || 'PENDING',
      transactionDate,
      walletAmountUsed: walletAmountUsedStr,
    });

    res.status(201).json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

