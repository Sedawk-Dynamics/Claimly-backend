import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { createOrder, verifyAndCreateSubscription } from '../services/payment.service';
import { verifyAndCreateSubscriptionAppleIap } from '../services/appleIap.service';
import { env } from '../config/env';

/**
 * Create a Razorpay payment order
 * POST /payment/create-order
 */
export const createPaymentOrderController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { amount, currency, receipt, notes } = req.body;

    // Convert amount from rupees to paise (Razorpay expects amount in smallest currency unit)
    const amountInPaise = Math.round(amount * 100);

    const order = await createOrder({
      amount: amountInPaise,
      currency: currency || 'INR',
      receipt: receipt || `receipt_${req.user.userId}_${Date.now()}`,
      notes: {
        ...notes,
        userId: req.user.userId,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
        key_id: env.RAZORPAY_KEY_ID, // Return key_id for frontend
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Razorpay payment and create subscription
 * POST /payment/verify
 */
export const verifyPaymentController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planName,
      amount,
      walletAmountUsed,
    } = req.body;

    const result = await verifyAndCreateSubscription({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      userId: req.user.userId,
      planName,
      amount,
      walletAmountUsed,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Apple In-App Purchase receipt and create subscription (iOS).
 * Wallet, referral, and discount work the same as Razorpay.
 * POST /payment/apple-verify
 */
export const verifyAppleIapController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { receiptData, planName, productId, transactionId, walletAmountUsed } = req.body;

    const result = await verifyAndCreateSubscriptionAppleIap({
      receiptData,
      planName,
      productId,
      transactionId,
      userId: req.user.userId,
      walletAmountUsed,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
