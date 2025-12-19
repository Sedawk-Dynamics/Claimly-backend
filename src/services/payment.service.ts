import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../config/env';
import logger from '../config/logger';
import { ValidationError } from '../utils/errors';
import { createSubscription } from './subscription.service';
import { getSubscriptionPlanByName } from './subscriptionPlan.service';

// Initialize Razorpay instance
let razorpayInstance: Razorpay | null = null;

function getRazorpayInstance(): Razorpay {
  if (!razorpayInstance) {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.');
    }
    razorpayInstance = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayInstance;
}

export interface CreateOrderData {
  amount: number; // Amount in paise (smallest currency unit)
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface CreateOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  offer_id: string | null;
  status: string;
  attempts: number;
  notes: Record<string, string>;
  created_at: number;
}

export interface VerifyPaymentData {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  userId: string;
  planName: string;
  amount: string;
  walletAmountUsed?: string;
}

/**
 * Create a Razorpay order
 */
export const createOrder = async (data: CreateOrderData): Promise<CreateOrderResponse> => {
  try {
    logger.info('Creating Razorpay order', { amount: data.amount, currency: data.currency });
    
    const razorpay = getRazorpayInstance();
    
    const options = {
      amount: data.amount, // Amount in paise
      currency: data.currency || 'INR',
      receipt: data.receipt || `receipt_${Date.now()}`,
      notes: data.notes || {},
    };

    const order = await razorpay.orders.create(options);
    
    logger.info('Razorpay order created successfully', { orderId: order.id });
    
    return order as CreateOrderResponse;
  } catch (error: any) {
    logger.error('Error creating Razorpay order', { 
      error: error.message,
      stack: error.stack,
      amount: data.amount,
    });
    throw new ValidationError(`Failed to create payment order: ${error.message}`);
  }
};

/**
 * Verify Razorpay payment signature
 */
export const verifyPaymentSignature = (
  orderId: string,
  paymentId: string,
  signature: string
): boolean => {
  try {
    const secret = env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      throw new Error('Razorpay secret key not configured');
    }

    // Create the signature payload
    const payload = `${orderId}|${paymentId}`;
    
    // Generate the expected signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // Compare signatures
    const isValid = expectedSignature === signature;
    
    logger.info('Payment signature verification', { 
      orderId, 
      paymentId, 
      isValid,
    });
    
    return isValid;
  } catch (error: any) {
    logger.error('Error verifying payment signature', { 
      error: error.message,
      orderId,
      paymentId,
    });
    return false;
  }
};

/**
 * Verify payment and create subscription
 */
export const verifyAndCreateSubscription = async (data: VerifyPaymentData) => {
  try {
    logger.info('Verifying payment and creating subscription', {
      orderId: data.razorpay_order_id,
      paymentId: data.razorpay_payment_id,
      userId: data.userId,
      planName: data.planName,
      amount: data.amount,
    });

    // Get plan from database to validate amount
    const plan = await getSubscriptionPlanByName(data.planName);
    if (!plan) {
      throw new ValidationError(`Subscription plan "${data.planName}" not found`);
    }

    if (plan.status !== 'ACTIVE') {
      throw new ValidationError(`Subscription plan "${data.planName}" is not active`);
    }

    // Validate that the amount matches the plan price
    const planPrice = parseFloat(plan.price);
    const providedAmount = parseFloat(data.amount);
    if (isNaN(providedAmount) || Math.abs(providedAmount - planPrice) > 0.01) {
      logger.warn('Amount mismatch detected', {
        planName: data.planName,
        planPrice,
        providedAmount,
        difference: Math.abs(providedAmount - planPrice),
      });
      throw new ValidationError(
        `Amount mismatch. Plan "${data.planName}" price is Rs. ${planPrice}, but provided amount is Rs. ${providedAmount}`
      );
    }

    // Verify payment signature
    const isValid = verifyPaymentSignature(
      data.razorpay_order_id,
      data.razorpay_payment_id,
      data.razorpay_signature
    );

    if (!isValid) {
      throw new ValidationError('Invalid payment signature. Payment verification failed.');
    }

    // Use plan price from database instead of frontend-provided amount for security
    const validatedAmount = planPrice.toString();

    // Get payment details from Razorpay to confirm status
    const razorpay = getRazorpayInstance();
    let paymentDetails;
    try {
      paymentDetails = await razorpay.payments.fetch(data.razorpay_payment_id);
    } catch (error: any) {
      logger.error('Error fetching payment details from Razorpay', { 
        error: error.message,
        paymentId: data.razorpay_payment_id,
      });
      // Continue with signature verification if fetch fails
      // The signature verification is the primary security check
    }

    // Determine payment status
    let paymentStatus: 'SUCCESS' | 'PENDING' | 'FAILED' = 'SUCCESS';
    if (paymentDetails) {
      const status = (paymentDetails.status as string)?.toLowerCase();
      if (status === 'captured' || status === 'authorized') {
        paymentStatus = 'SUCCESS';
      } else if (status === 'created' || status === 'pending') {
        paymentStatus = 'PENDING';
      } else if (status === 'failed' || status === 'refunded') {
        paymentStatus = 'FAILED';
      } else {
        // Default to success if signature is verified (signature verification is primary check)
        paymentStatus = 'SUCCESS';
      }
    }

    // Create subscription using validated amount from database
    const subscription = await createSubscription({
      userId: data.userId,
      planName: data.planName,
      amount: validatedAmount, // Use validated amount from database
      paymentId: data.razorpay_payment_id,
      paymentStatus,
      transactionDate: new Date().toISOString(),
      walletAmountUsed: data.walletAmountUsed,
      orderId: data.razorpay_order_id, // Pass Razorpay Order ID
    });

    logger.info('Payment verified and subscription created successfully', {
      subscriptionId: subscription.id,
      paymentId: data.razorpay_payment_id,
    });

    return {
      success: true,
      subscription,
      paymentStatus,
    };
  } catch (error: any) {
    logger.error('Error verifying payment and creating subscription', {
      error: error.message,
      stack: error.stack,
      orderId: data.razorpay_order_id,
      paymentId: data.razorpay_payment_id,
    });
    throw error;
  }
};
