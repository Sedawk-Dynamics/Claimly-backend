import prisma from '../config/prismaClient';
import { NotFoundError, ValidationError, AppError } from '../utils/errors';
import logger from '../config/logger';

export interface WalletBalance {
  balance: number;
  currency: string;
}

export interface WalletTransaction {
  id: string;
  transactionType: 'REFERRAL_REWARD' | 'REDEMPTION' | 'REFUND';
  amount: number;
  description: string;
  createdAt: string;
  relatedUserId?: string;
}

export const getWalletBalance = async (userId: string): Promise<WalletBalance> => {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: { wallet_balance: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return {
    balance: Number(user.wallet_balance),
    currency: 'INR',
  };
};

export const getWalletTransactions = async (userId: string): Promise<WalletTransaction[]> => {
  const transactions = await prisma.walletTransaction.findMany({
    where: { user_id: BigInt(userId) },
    orderBy: { created_at: 'desc' },
    take: 50, // Get last 50 transactions
    include: {
      related_subscription: {
        select: {
          plan_name: true,
          amount: true,
        },
      },
    },
  });

  return transactions.map((tx) => ({
    id: tx.id.toString(),
    transactionType: tx.transaction_type as 'REFERRAL_REWARD' | 'REDEMPTION' | 'REFUND',
    amount: Number(tx.amount),
    description: tx.description,
    createdAt: tx.created_at.toISOString(),
    relatedUserId: tx.related_user_id ? tx.related_user_id.toString() : undefined,
  }));
};

export const redeemWalletForSubscription = async (
  userId: string,
  subscriptionAmount: number,
  walletAmountToUse: number
): Promise<{ remainingAmount: number; walletAmountUsed: number }> => {
  // Verify user exists and get wallet balance
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: { wallet_balance: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const walletBalance = Number(user.wallet_balance);

  // Validate wallet amount
  if (walletAmountToUse <= 0) {
    throw new ValidationError('Wallet amount must be greater than 0');
  }

  if (walletAmountToUse > walletBalance) {
    throw new ValidationError('Insufficient wallet balance');
  }

  if (walletAmountToUse > subscriptionAmount) {
    throw new ValidationError('Wallet amount cannot exceed subscription amount');
  }

  // Minimum threshold check - for now, allow any amount (can be configured)
  const MINIMUM_REDEMPTION_AMOUNT = 0; // Can be set to a minimum like 100

  if (walletBalance < MINIMUM_REDEMPTION_AMOUNT) {
    throw new ValidationError(`Minimum wallet balance of ₹${MINIMUM_REDEMPTION_AMOUNT} required for redemption`);
  }

  const remainingAmount = subscriptionAmount - walletAmountToUse;

  logger.info('Wallet redemption validated', {
    userId,
    subscriptionAmount,
    walletAmountToUse,
    remainingAmount,
    walletBalance,
  });

  return {
    remainingAmount,
    walletAmountUsed: walletAmountToUse,
  };
};

export const getWalletRedemptionEligibility = async (userId: string): Promise<{
  isEligible: boolean;
  currentBalance: number;
  minimumRequired?: number;
}> => {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: { wallet_balance: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const currentBalance = Number(user.wallet_balance);
  const MINIMUM_REDEMPTION_AMOUNT = 0; // Can be configured

  return {
    isEligible: currentBalance >= MINIMUM_REDEMPTION_AMOUNT,
    currentBalance,
    minimumRequired: MINIMUM_REDEMPTION_AMOUNT > 0 ? MINIMUM_REDEMPTION_AMOUNT : undefined,
  };
};

