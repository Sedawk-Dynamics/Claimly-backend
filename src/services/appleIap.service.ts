/**
 * Apple In-App Purchase (IAP) service.
 * Second payment option alongside Razorpay (used for iOS / App Store).
 * Reuses createSubscription – wallet, referral, and discount logic unchanged.
 */

import { env } from '../config/env';
import logger from '../config/logger';
import { ValidationError } from '../utils/errors';
import { createSubscription } from './subscription.service';
import { getSubscriptionPlanByName } from './subscriptionPlan.service';
import prisma from '../config/prismaClient';

const APPLE_VERIFY_PRODUCTION = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_VERIFY_SANDBOX = 'https://sandbox.itunes.apple.com/verifyReceipt';

/** Apple verifyReceipt request body */
interface VerifyReceiptRequest {
  'receipt-data': string;
  password: string;
  'exclude-old-transactions': boolean;
}

/** Single in-app purchase in Apple receipt */
interface AppleInAppItem {
  product_id: string;
  transaction_id: string;
  original_transaction_id?: string;
  quantity?: string;
  purchase_date_ms?: string;
  /** Auto-renewable subscriptions */
  expires_date_ms?: string;
  /** StoreKit 2 appAccountToken may appear as this field in some payloads */
  app_account_token?: string;
  [key: string]: unknown;
}

/** Apple verifyReceipt response */
interface VerifyReceiptResponse {
  status: number;
  receipt?: {
    in_app?: AppleInAppItem[];
    bundle_id?: string;
    [key: string]: unknown;
  };
  latest_receipt_info?: AppleInAppItem[] | AppleInAppItem;
  [key: string]: unknown;
}

export interface VerifyAppleIapData {
  receiptData: string;
  planName: string;
  productId: string;
  transactionId?: string;
  userId: string;
  walletAmountUsed?: string;
}

/**
 * Call Apple's verifyReceipt endpoint.
 * Handles 21007 (use sandbox) and 21008 (use production) by retrying.
 */
async function callVerifyReceipt(
  receiptData: string,
  useSandbox: boolean
): Promise<VerifyReceiptResponse> {
  const url = useSandbox ? APPLE_VERIFY_SANDBOX : APPLE_VERIFY_PRODUCTION;
  const body: VerifyReceiptRequest = {
    'receipt-data': receiptData,
    password: env.APPLE_IAP_SHARED_SECRET,
    'exclude-old-transactions': true,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Apple verifyReceipt HTTP error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as VerifyReceiptResponse;
  return data;
}

/**
 * Verify receipt with Apple, retrying sandbox/production as per status codes.
 */
async function verifyReceiptWithApple(receiptData: string): Promise<VerifyReceiptResponse> {
  let useSandbox = env.APPLE_IAP_USE_SANDBOX;
  let lastResponse: VerifyReceiptResponse | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    lastResponse = await callVerifyReceipt(receiptData, useSandbox);

    if (lastResponse.status === 0) {
      return lastResponse;
    }

    if (lastResponse.status === 21007) {
      useSandbox = true;
      logger.info('Apple receipt is for sandbox, retrying with sandbox URL');
      continue;
    }
    if (lastResponse.status === 21008) {
      useSandbox = false;
      logger.info('Apple receipt is for production, retrying with production URL');
      continue;
    }

    break;
  }

  if (!lastResponse) {
    throw new ValidationError('Apple receipt verification failed: no response');
  }

  const statusMessages: Record<number, string> = {
    21000: 'The App Store could not read the JSON you provided.',
    21002: 'The data in the receipt-data property was malformed or missing.',
    21003: 'The receipt could not be authenticated.',
    21004: 'The shared secret you provided does not match the shared secret on file.',
    21005: 'The receipt server is not currently available.',
    21006: 'This receipt is valid but the subscription has expired.',
    21007: 'This receipt is from the test environment.',
    21008: 'This receipt is from the production environment.',
    21010: 'This receipt could not be authorized.',
  };

  const msg =
    statusMessages[lastResponse.status] ||
    `Apple receipt verification failed with status ${lastResponse.status}`;
  throw new ValidationError(msg);
}

/**
 * Find the in-app transaction matching productId (and optionally transactionId).
 */
function findMatchingTransaction(
  response: VerifyReceiptResponse,
  productId: string,
  transactionId?: string
): AppleInAppItem | null {
  const latest = response.latest_receipt_info;
  const latestArray: AppleInAppItem[] = Array.isArray(latest)
    ? latest
    : latest
      ? [latest]
      : [];
  const inAppArray: AppleInAppItem[] = Array.isArray(response.receipt?.in_app)
    ? (response.receipt?.in_app as AppleInAppItem[])
    : [];

  // For subscriptions, latest_receipt_info is typically the best source. Fallback to receipt.in_app.
  const candidates = (latestArray.length > 0 ? latestArray : inAppArray).filter(
    (item) => item.product_id === productId
  );

  if (candidates.length === 0) return null;

  // If client provided a transactionId, match exactly.
  if (transactionId) {
    const exact = candidates.filter((item) => item.transaction_id === transactionId);
    if (exact.length === 0) return null;
    return exact[exact.length - 1];
  }

  // Otherwise pick the most recent by expires_date_ms (subscriptions) then purchase_date_ms.
  const sorted = [...candidates].sort((a, b) => {
    const aExpires = a.expires_date_ms ? Number(a.expires_date_ms) : -1;
    const bExpires = b.expires_date_ms ? Number(b.expires_date_ms) : -1;
    if (aExpires !== bExpires) return aExpires - bExpires;
    const aPurchase = a.purchase_date_ms ? Number(a.purchase_date_ms) : -1;
    const bPurchase = b.purchase_date_ms ? Number(b.purchase_date_ms) : -1;
    return aPurchase - bPurchase;
  });
  return sorted[sorted.length - 1];
}

function parseMsDate(ms?: string): Date | null {
  if (!ms) return null;
  const n = Number(ms);
  if (Number.isNaN(n) || n <= 0) return null;
  return new Date(n);
}

function mapSubscriptionRow(sub: any) {
  return {
    id: sub.id.toString(),
    userId: sub.user_id.toString(),
    planName: sub.plan_name,
    amount: sub.amount.toString(),
    paymentId: sub.payment_id,
    paymentStatus: sub.payment_status,
    transactionDate:
      sub.transaction_date instanceof Date
        ? sub.transaction_date.toISOString()
        : (sub.transaction_date as unknown as string),
    expiresAt: sub.expires_at ? sub.expires_at.toISOString() : null,
    walletAmountUsed: sub.wallet_amount_used ? sub.wallet_amount_used.toString() : '0',
    receiptUrl: sub.receipt_url || null,
  };
}

/**
 * Verify Apple IAP receipt and create subscription.
 * Wallet, referral, and discount behaviour are unchanged (handled inside createSubscription).
 */
export async function verifyAndCreateSubscriptionAppleIap(data: VerifyAppleIapData) {
  if (!env.APPLE_IAP_SHARED_SECRET?.trim()) {
    throw new ValidationError(
      'Apple In-App Purchase is not configured. Set APPLE_IAP_SHARED_SECRET.'
    );
  }

  logger.info('Verifying Apple IAP and creating subscription', {
    userId: data.userId,
    planName: data.planName,
    productId: data.productId,
    transactionId: data.transactionId,
  });

  const plan = await getSubscriptionPlanByName(data.planName);
  if (!plan) {
    throw new ValidationError(`Subscription plan "${data.planName}" not found`);
  }
  if (plan.status !== 'ACTIVE') {
    throw new ValidationError(`Subscription plan "${data.planName}" is not active`);
  }

  const productPlanMap = env.APPLE_IAP_PRODUCT_PLAN_MAP || {};
  if (Object.keys(productPlanMap).length > 0) {
    const expectedPlan = productPlanMap[data.productId];
    if (expectedPlan && expectedPlan !== data.planName) {
      throw new ValidationError(
        `Product ${data.productId} is mapped to plan "${expectedPlan}", not "${data.planName}"`
      );
    }
  }

  const response = await verifyReceiptWithApple(data.receiptData);
  // Bundle ID verification (recommended in production)
  if (env.APPLE_IAP_BUNDLE_ID) {
    const receiptBundleId = response.receipt?.bundle_id;
    if (!receiptBundleId || receiptBundleId !== env.APPLE_IAP_BUNDLE_ID) {
      throw new ValidationError(
        `Apple receipt bundle_id mismatch. Expected "${env.APPLE_IAP_BUNDLE_ID}", got "${receiptBundleId || 'unknown'}".`
      );
    }
  }

  const transaction = findMatchingTransaction(
    response,
    data.productId,
    data.transactionId || undefined
  );

  if (!transaction) {
    throw new ValidationError(
      `Receipt does not contain a valid transaction for product "${data.productId}"`
    );
  }

  const txId = transaction.transaction_id;
  const originalTxId = transaction.original_transaction_id || txId;
  const expiresAt = parseMsDate(transaction.expires_date_ms);
  const purchaseDate = parseMsDate(transaction.purchase_date_ms);

  // User-binding + idempotency:
  // We key Apple subscriptions by original_transaction_id so a purchase chain cannot be claimed by multiple users.
  // To keep backwards compatibility with earlier records that used transaction_id, we match both.
  const existing = await prisma.subscription.findFirst({
    where: {
      OR: [{ payment_id: originalTxId }, { payment_id: txId }],
    },
  });
  if (existing) {
    // Do NOT leak or allow cross-account claims.
    if (existing.user_id.toString() !== data.userId) {
      logger.warn('Apple IAP original transaction already linked to a different user', {
        originalTxId,
        txId,
        existingUserId: existing.user_id.toString(),
        requestUserId: data.userId,
      });
      throw new ValidationError('This Apple purchase is already linked to another user.');
    }

    // If older record stored txId, migrate key to originalTxId (safer binding for subscription renewals).
    if (existing.payment_id !== originalTxId) {
      try {
        await prisma.subscription.update({
          where: { id: existing.id },
          data: { payment_id: originalTxId },
        });
      } catch (e) {
        logger.warn('Failed to migrate Apple IAP payment_id to original_transaction_id', {
          subscriptionId: existing.id.toString(),
          from: existing.payment_id,
          to: originalTxId,
        });
      }
    }

    // For auto-renewable subscriptions, update expiry if Apple shows a newer expiration.
    if (expiresAt) {
      const shouldUpdate = !existing.expires_at || existing.expires_at.getTime() < expiresAt.getTime();
      if (shouldUpdate) {
        await prisma.subscription.update({
          where: { id: existing.id },
          data: { expires_at: expiresAt },
        });
      }
    }

    const sub = await prisma.subscription.findUnique({ where: { id: existing.id } });
    if (!sub) throw new ValidationError('Subscription not found');

    logger.info('Apple IAP transaction already processed (idempotent)', {
      subscriptionId: sub.id.toString(),
      originalTxId,
      txId,
    });

    return {
      success: true,
      subscription: mapSubscriptionRow(sub),
      paymentStatus: sub.payment_status,
      alreadyProcessed: true,
    };
  }

  const planPrice = parseFloat(plan.price);
  const validatedAmount = planPrice.toString();

  const subscription = await createSubscription({
    userId: data.userId,
    planName: data.planName,
    amount: validatedAmount,
    // Store original_transaction_id as the canonical key (binds subscription chain to this user)
    paymentId: originalTxId,
    paymentStatus: 'SUCCESS',
    transactionDate: (purchaseDate || new Date()).toISOString(),
    walletAmountUsed: data.walletAmountUsed,
    orderId: `apple_iap_${txId}`,
    paymentMethod: 'iap',
  });

  // If Apple provides an expiry (auto-renewable subscription), persist it.
  if (expiresAt) {
    try {
      await prisma.subscription.update({
        where: { id: BigInt(subscription.id) },
        data: { expires_at: expiresAt },
      });
    } catch (e) {
      logger.warn('Failed to persist Apple subscription expires_at', {
        subscriptionId: subscription.id,
        originalTxId,
        expiresAt: expiresAt.toISOString(),
      });
    }
  }

  logger.info('Apple IAP verified and subscription created', {
    subscriptionId: subscription.id,
    originalTxId,
    txId,
  });

  // Re-read to return authoritative DB values (including expires_at if updated above)
  const createdRow = await prisma.subscription.findUnique({
    where: { id: BigInt(subscription.id) },
  });
  if (!createdRow) throw new ValidationError('Subscription not found');

  return {
    success: true,
    subscription: mapSubscriptionRow(createdRow),
    paymentStatus: 'SUCCESS' as const,
    alreadyProcessed: false,
  };
}
