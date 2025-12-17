import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import {
  getWalletBalance,
  getWalletTransactions,
  getWalletRedemptionEligibility,
} from '../services/wallet.service';

export const getWalletBalanceController = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const balance = await getWalletBalance(req.user.userId);
    res.status(200).json({
      success: true,
      data: balance,
    });
  } catch (error) {
    next(error);
  }
};

export const getWalletTransactionsController = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const transactions = await getWalletTransactions(req.user.userId);
    res.status(200).json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    next(error);
  }
};

export const getWalletEligibilityController = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const eligibility = await getWalletRedemptionEligibility(req.user.userId);
    res.status(200).json({
      success: true,
      data: eligibility,
    });
  } catch (error) {
    next(error);
  }
};

