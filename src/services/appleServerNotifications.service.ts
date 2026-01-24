/**
 * App Store Server Notifications (v2) handler.
 *
 * Verifies Apple's signedPayload (JWS) and updates subscription lifecycle state
 * (primarily expiration) for Apple auto-renewable subscriptions.
 *
 * Notes:
 * - We key Apple subscriptions by originalTransactionId in Subscription.payment_id.
 * - We try SANDBOX and PRODUCTION verification to support mixed environments.
 */
import { SignedDataVerifier, Environment } from '@apple/app-store-server-library';
import prisma from '../config/prismaClient';
import logger from '../config/logger';
import { env } from '../config/env';
import { getAppleRootCAs } from '../config/appleRootCAs';

function parseEpochMs(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  if (Number.isNaN(n) || n <= 0) return null;
  return new Date(n);
}

function getNotificationType(decoded: any): string | undefined {
  return decoded?.notificationType || decoded?.notification_type;
}

function extractTransactionInfo(decoded: any): any {
  // The Apple library typically returns decoded transaction info objects,
  // but keep it defensive.
  return decoded?.data?.signedTransactionInfo || decoded?.data?.transactionInfo || decoded?.data?.signed_transaction_info;
}

function extractRenewalInfo(decoded: any): any {
  return decoded?.data?.signedRenewalInfo || decoded?.data?.renewalInfo || decoded?.data?.signed_renewal_info;
}

function extractOriginalTransactionId(tx: any): string | null {
  return (
    tx?.originalTransactionId ||
    tx?.original_transaction_id ||
    tx?.originalTransactionID ||
    null
  );
}

function extractExpiresDate(tx: any): Date | null {
  // In notifications v2, expiresDate is typically epoch ms.
  return parseEpochMs(tx?.expiresDate ?? tx?.expires_date ?? tx?.expires_date_ms);
}

export async function processAppStoreServerNotification(signedPayload: string) {
  if (!env.APPLE_IAP_BUNDLE_ID) {
    // We can still accept the webhook but cannot verify without knowing bundleId
    logger.warn('APPLE_IAP_BUNDLE_ID is missing; cannot verify App Store notification signedPayload');
    return { verified: false, updated: false };
  }

  const appleRootCAs = getAppleRootCAs();
  const enableOnlineChecks = env.NODE_ENV === 'production';

  const attemptVerify = async (environment: Environment) => {
    const verifier = new SignedDataVerifier(
      appleRootCAs,
      enableOnlineChecks,
      environment,
      env.APPLE_IAP_BUNDLE_ID,
      environment === Environment.PRODUCTION ? env.APPLE_IAP_APP_APPLE_ID : undefined
    );
    return await verifier.verifyAndDecodeNotification(signedPayload);
  };

  let decoded: any;
  let usedEnv: Environment | null = null;
  try {
    decoded = await attemptVerify(env.APPLE_IAP_USE_SANDBOX ? Environment.SANDBOX : Environment.PRODUCTION);
    usedEnv = env.APPLE_IAP_USE_SANDBOX ? Environment.SANDBOX : Environment.PRODUCTION;
  } catch (e1) {
    // Retry with the other environment (similar to 21007/21008 behavior)
    try {
      decoded = await attemptVerify(env.APPLE_IAP_USE_SANDBOX ? Environment.PRODUCTION : Environment.SANDBOX);
      usedEnv = env.APPLE_IAP_USE_SANDBOX ? Environment.PRODUCTION : Environment.SANDBOX;
    } catch (e2) {
      logger.warn('Failed to verify App Store server notification signedPayload', {
        error: e2 instanceof Error ? e2.message : 'Unknown error',
      });
      return { verified: false, updated: false };
    }
  }

  const notificationType = getNotificationType(decoded);
  const txInfo = extractTransactionInfo(decoded);
  const renewalInfo = extractRenewalInfo(decoded);

  const originalTxId = extractOriginalTransactionId(txInfo);
  const expiresAt = extractExpiresDate(txInfo);

  logger.info('Received verified App Store server notification', {
    environment: usedEnv === Environment.SANDBOX ? 'SANDBOX' : 'PRODUCTION',
    notificationType,
    originalTxId,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    productId: txInfo?.productId || txInfo?.product_id,
    subtype: decoded?.subtype,
  });

  if (!originalTxId) {
    logger.warn('Verified notification missing originalTransactionId; skipping update');
    return { verified: true, updated: false };
  }

  const sub = await prisma.subscription.findFirst({
    where: { payment_id: originalTxId },
  });

  if (!sub) {
    logger.warn('No subscription found for originalTransactionId (notification)', { originalTxId });
    return { verified: true, updated: false };
  }

  // Update expiry if provided (auto-renewable subscriptions)
  if (expiresAt) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { expires_at: expiresAt },
    });
  }

  // Best-effort user subscription status update for expiring subscriptions.
  // We only flip status based on expires_at to avoid affecting lifetime subscriptions.
  const effectiveExpires = expiresAt ?? sub.expires_at ?? null;
  if (effectiveExpires) {
    const isExpired = effectiveExpires.getTime() <= Date.now();
    await prisma.user.update({
      where: { id: sub.user_id },
      data: { subscription_status: isExpired ? 'EXPIRED' : 'ACTIVE' },
    });
  }

  // For revocation/refund/expiration events, mark payment failed (optional signal).
  const terminalTypes = new Set(['REVOKE', 'REFUND', 'EXPIRED']);
  if (notificationType && terminalTypes.has(notificationType)) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { payment_status: 'FAILED' },
    });
  }

  return { verified: true, updated: true, notificationType, originalTxId };
}

