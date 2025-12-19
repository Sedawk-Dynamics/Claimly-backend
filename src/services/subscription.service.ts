import prisma from '../config/prismaClient';
import { NotFoundError, ValidationError } from '../utils/errors';
import logger from '../config/logger';
import { createActivityLog } from './userActivityLog.service';
import { createAlert } from './alert.service';
import { generateReceiptPDF, generateReceiptNumber } from './receipt.service';

export interface CreateSubscriptionData {
  userId: string;
  planName: string;
  amount: string;
  paymentId: string;
  paymentStatus: 'SUCCESS' | 'PENDING' | 'FAILED';
  transactionDate?: string;
  walletAmountUsed?: string; // Amount paid from wallet
  orderId?: string; // Razorpay Order ID
}

// Subscription validity period in days (1 month = 30 days)
const SUBSCRIPTION_VALIDITY_DAYS = 30;

export const createSubscription = async (data: CreateSubscriptionData) => {
  logger.info('Creating subscription', { 
    userId: data.userId, 
    paymentId: data.paymentId,
    walletAmountUsed: data.walletAmountUsed,
  });

  // Verify user exists and get wallet balance
  const user = await prisma.user.findUnique({
    where: { id: BigInt(data.userId) },
    select: {
      id: true,
      referred_by: true,
      wallet_balance: true,
      name: true,
      subscription_status: true,
      email: true,
      mobile_number: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Validate amount
  const amount = parseFloat(data.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new ValidationError('Amount must be a positive number');
  }

  // Validate wallet amount if provided
  let walletAmountUsed = 0;
  if (data.walletAmountUsed) {
    const parsed = parseFloat(String(data.walletAmountUsed).trim());
    if (isNaN(parsed)) {
      throw new ValidationError('Wallet amount must be a valid number');
    }
    if (parsed < 0) {
      throw new ValidationError('Wallet amount cannot be negative');
    }
    walletAmountUsed = parsed;
  }
  
  logger.info('Wallet amount processing', {
    walletAmountUsedInput: data.walletAmountUsed,
    walletAmountUsedParsed: walletAmountUsed,
    userWalletBalance: Number(user.wallet_balance),
    walletBalanceType: typeof user.wallet_balance,
  });

  // Check if user has sufficient wallet balance
  if (walletAmountUsed > 0) {
    const userBalance = Number(user.wallet_balance);
    if (isNaN(userBalance) || userBalance < 0) {
      logger.error('Invalid wallet balance for user', { userId: data.userId, walletBalance: user.wallet_balance });
      throw new ValidationError('Invalid wallet balance. Please contact support.');
    }
    
    if (walletAmountUsed > userBalance) {
      throw new ValidationError(`Insufficient wallet balance. Available: ₹${userBalance.toFixed(2)}, Requested: ₹${walletAmountUsed.toFixed(2)}`);
    }
    
    // Additional validation: ensure wallet amount doesn't exceed subscription amount
    if (walletAmountUsed > amount) {
      throw new ValidationError(`Wallet amount (₹${walletAmountUsed.toFixed(2)}) cannot exceed subscription amount (₹${amount.toFixed(2)})`);
    }
  }

  // Validate payment status
  const validStatuses = ['SUCCESS', 'PENDING', 'FAILED'];
  if (!validStatuses.includes(data.paymentStatus)) {
    throw new ValidationError(`paymentStatus must be one of: ${validStatuses.join(', ')}`);
  }

  // Use provided transaction date or current date
  const transactionDate = data.transactionDate ? new Date(data.transactionDate) : new Date();

  // Calculate subscription expiry date
  // If user has active subscription, extend from current expiry
  // Otherwise, start from transaction date
  let expiresAt: Date;
  if (user.subscription_status === 'ACTIVE') {
    // Get the latest active subscription to find expiry date
    const latestSubscription = await prisma.subscription.findFirst({
      where: {
        user_id: BigInt(data.userId),
        payment_status: 'SUCCESS',
      },
      orderBy: {
        transaction_date: 'desc',
      },
    });

    if (latestSubscription?.expires_at) {
      // Extend from current expiry date
      expiresAt = new Date(latestSubscription.expires_at);
      expiresAt.setDate(expiresAt.getDate() + SUBSCRIPTION_VALIDITY_DAYS);
      logger.info('Extending existing subscription', { 
        currentExpiry: latestSubscription.expires_at,
        newExpiry: expiresAt,
      });
    } else {
      // Fallback: start from transaction date if no expiry found
      expiresAt = new Date(transactionDate);
      expiresAt.setDate(expiresAt.getDate() + SUBSCRIPTION_VALIDITY_DAYS);
      logger.info('No expiry date found, starting fresh from transaction date');
    }
  } else {
    // New subscription: start from transaction date
    expiresAt = new Date(transactionDate);
    expiresAt.setDate(expiresAt.getDate() + SUBSCRIPTION_VALIDITY_DAYS);
    logger.info('New subscription, expiry date set from transaction date');
  }

  // Create subscription and deduct wallet in a transaction
  const subscription = await prisma.$transaction(async (tx) => {
    // Deduct wallet amount if used (within transaction)
    if (walletAmountUsed > 0) {
      await tx.user.update({
        where: { id: BigInt(data.userId) },
        data: {
          wallet_balance: {
            decrement: walletAmountUsed,
          },
        },
      });

      logger.info('Wallet amount deducted for subscription', { 
        userId: data.userId, 
        walletAmountUsed,
        remainingBalance: Number(user.wallet_balance) - walletAmountUsed,
      });
    }

    // Create subscription record
    const newSubscription = await tx.subscription.create({
      data: {
        user_id: BigInt(data.userId),
        plan_name: data.planName,
        amount: amount,
        payment_id: data.paymentId,
        payment_status: data.paymentStatus,
        transaction_date: transactionDate,
        expires_at: expiresAt,
        wallet_amount_used: walletAmountUsed > 0 ? walletAmountUsed : null,
      },
    });

    // Update user subscription status to ACTIVE if payment is successful
    if (data.paymentStatus === 'SUCCESS') {
      await tx.user.update({
        where: { id: BigInt(data.userId) },
        data: { subscription_status: 'ACTIVE' },
      });
      logger.info('User subscription status updated to ACTIVE', { userId: data.userId });

      // Create wallet transaction for redemption if wallet was used (within transaction)
      if (walletAmountUsed > 0) {
        await tx.walletTransaction.create({
          data: {
            user_id: BigInt(data.userId),
            transaction_type: 'REDEMPTION',
            amount: walletAmountUsed,
            description: `Wallet redemption for subscription: ${data.planName}`,
            related_subscription_id: newSubscription.id,
          },
        });
        logger.info('Wallet transaction created for redemption', { 
          userId: data.userId, 
          amount: walletAmountUsed,
          subscriptionId: newSubscription.id.toString(),
        });
      }
    }

    return newSubscription;
  });

  // Award referral reward if user was referred and this is their first successful subscription
  if (data.paymentStatus === 'SUCCESS' && user.referred_by) {
    // Check if this is the user's first successful subscription
    const previousSuccessfulSubscriptions = await prisma.subscription.count({
      where: {
        user_id: BigInt(data.userId),
        payment_status: 'SUCCESS',
        id: { not: subscription.id },
      },
    });

    // Award reward only for first successful subscription
    if (previousSuccessfulSubscriptions === 0) {
      // Calculate reward: 10% of subscription amount (configurable)
      const rewardPercentage = 0.10; // 10%
      const rewardAmount = amount * rewardPercentage;

      // Update referrer's wallet balance
      await prisma.$transaction(async (tx) => {
        // Add to referrer's wallet
        await tx.user.update({
          where: { id: user.referred_by! },
          data: {
            wallet_balance: {
              increment: rewardAmount,
            },
          },
        });

        // Create wallet transaction record
        await tx.walletTransaction.create({
          data: {
            user_id: user.referred_by!,
            transaction_type: 'REFERRAL_REWARD',
            amount: rewardAmount,
            description: `Referral reward for ${user.name}'s subscription (${data.planName})`,
            related_user_id: BigInt(data.userId),
            related_subscription_id: subscription.id,
          },
        });
      });

      logger.info('Referral reward awarded', {
        referrerId: user.referred_by.toString(),
        referredUserId: data.userId,
        rewardAmount,
        subscriptionId: subscription.id.toString(),
      });
    }
  }

  // Generate our own receipt PDF and store receipt URL for successful payments
  let receiptUrl: string | null = null;
  if (data.paymentStatus === 'SUCCESS') {
    try {
      // Always generate our own PDF receipt for consistency and to store in database
      const finalAmountPaid = amount - walletAmountUsed;
      const receiptNumber = generateReceiptNumber();
      const receiptPath = await generateReceiptPDF({
        subscriptionId: subscription.id.toString(),
        receiptNumber: receiptNumber,
        userId: data.userId,
        userName: user.name,
        userEmail: user.email,
        userPhone: user.mobile_number,
        orderId: data.orderId || data.paymentId, // Use order ID if available, fallback to payment ID
        paymentId: data.paymentId,
        paymentStatus: data.paymentStatus,
        planName: data.planName,
        amount: amount,
        currency: 'INR',
        walletAmountUsed: walletAmountUsed > 0 ? walletAmountUsed : undefined,
        finalAmountPaid: finalAmountPaid,
        transactionDate: transactionDate,
        expiresAt: expiresAt,
      });
      receiptUrl = receiptPath;
      logger.info('Receipt PDF generated and stored', { 
        subscriptionId: subscription.id.toString(), 
        receiptUrl,
        paymentId: data.paymentId,
      });

      // Update subscription with receipt URL (stored in database for future access)
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { receipt_url: receiptUrl },
      });
      logger.info('Receipt URL stored in database', { 
        subscriptionId: subscription.id.toString(),
        receiptUrl,
      });
    } catch (receiptError: any) {
      // Don't fail the subscription creation if receipt generation fails
      logger.error('Failed to generate receipt', {
        error: receiptError.message,
        stack: receiptError.stack,
        subscriptionId: subscription.id.toString(),
      });
    }

    // Create alert for admin panel when subscription is successfully purchased
    await createAlert({
      userId: data.userId,
      detectedVia: 'MANUAL',
      remarks: `Subscription purchased: ${data.planName} - ₹${data.amount} (Payment ID: ${data.paymentId})${walletAmountUsed > 0 ? ` - ₹${walletAmountUsed} from wallet` : ''}`,
    }).catch((err) => {
      // Don't fail the request if alert creation fails
      logger.error('Failed to create alert for subscription purchase', { error: err, userId: data.userId });
    });
  }

  logger.info('Subscription created successfully', { subscriptionId: subscription.id.toString() });

  // Log activity
  await createActivityLog({
    userId: data.userId,
    activityType: 'SUBSCRIPTION_CREATED',
    description: `New subscription: ${data.planName} - ${data.paymentStatus}`,
    metadata: {
      subscriptionId: subscription.id.toString(),
      planName: data.planName,
      amount: data.amount,
      paymentId: data.paymentId,
      paymentStatus: data.paymentStatus,
      transactionDate: subscription.transaction_date.toISOString(),
    },
  }).catch((err) => {
    // Don't fail the request if logging fails
    console.error('Failed to log activity:', err);
  });

  // Fetch updated subscription with receipt URL
  const updatedSubscription = await prisma.subscription.findUnique({
    where: { id: subscription.id },
  });

  return {
    id: updatedSubscription!.id.toString(),
    userId: updatedSubscription!.user_id.toString(),
    planName: updatedSubscription!.plan_name,
    amount: updatedSubscription!.amount.toString(),
    paymentId: updatedSubscription!.payment_id,
    paymentStatus: updatedSubscription!.payment_status,
    transactionDate: updatedSubscription!.transaction_date,
    expiresAt: updatedSubscription!.expires_at ? updatedSubscription!.expires_at.toISOString() : null,
    walletAmountUsed: updatedSubscription!.wallet_amount_used ? updatedSubscription!.wallet_amount_used.toString() : '0',
    receiptUrl: updatedSubscription!.receipt_url || null,
  };
};

