import prisma from '../config/prismaClient';
import { NotFoundError, ValidationError } from '../utils/errors';
import logger from '../config/logger';
import { createActivityLog } from './userActivityLog.service';

export interface CreateSubscriptionData {
  userId: string;
  planName: string;
  amount: string;
  paymentId: string;
  paymentStatus: 'SUCCESS' | 'PENDING' | 'FAILED';
  transactionDate?: string;
}

export const createSubscription = async (data: CreateSubscriptionData) => {
  logger.info('Creating subscription', { userId: data.userId, paymentId: data.paymentId });

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: BigInt(data.userId) },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Validate amount
  const amount = parseFloat(data.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new ValidationError('Amount must be a positive number');
  }

  // Validate payment status
  const validStatuses = ['SUCCESS', 'PENDING', 'FAILED'];
  if (!validStatuses.includes(data.paymentStatus)) {
    throw new ValidationError(`paymentStatus must be one of: ${validStatuses.join(', ')}`);
  }

  // Use provided transaction date or current date
  const transactionDate = data.transactionDate ? new Date(data.transactionDate) : new Date();

  // Create subscription record
  const subscription = await prisma.subscription.create({
    data: {
      user_id: BigInt(data.userId),
      plan_name: data.planName,
      amount: amount,
      payment_id: data.paymentId,
      payment_status: data.paymentStatus,
      transaction_date: transactionDate,
    },
  });

  // Update user subscription status to ACTIVE if payment is successful
  if (data.paymentStatus === 'SUCCESS') {
    await prisma.user.update({
      where: { id: BigInt(data.userId) },
      data: { subscription_status: 'ACTIVE' },
    });
    logger.info('User subscription status updated to ACTIVE', { userId: data.userId });
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

  return {
    id: subscription.id.toString(),
    userId: subscription.user_id.toString(),
    planName: subscription.plan_name,
    amount: subscription.amount.toString(),
    paymentId: subscription.payment_id,
    paymentStatus: subscription.payment_status,
    transactionDate: subscription.transaction_date,
  };
};

