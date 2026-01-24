import { Request, Response, NextFunction } from 'express';
import { processAppStoreServerNotification } from '../services/appleServerNotifications.service';
import logger from '../config/logger';

/**
 * App Store Server Notifications (v2) webhook.
 * Apple sends: { "signedPayload": "<JWS>" }
 *
 * No auth: Apple must be able to reach it. Security is enforced via JWS verification.
 */
export const appleServerNotificationController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const signedPayload = (req.body?.signedPayload || req.body?.signed_payload) as string | undefined;
    if (!signedPayload || typeof signedPayload !== 'string') {
      res.status(400).json({ success: false, error: 'signedPayload is required' });
      return;
    }

    const result = await processAppStoreServerNotification(signedPayload);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    logger.error('Apple server notification processing failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    next(err as Error);
  }
};

