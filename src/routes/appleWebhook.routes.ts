import { Router } from 'express';
import { appleServerNotificationController } from '../controllers/appleWebhook.controller';

const router = Router();

/**
 * App Store Server Notifications v2 webhook (no auth).
 * Apple will POST JSON: { signedPayload: "<JWS>" }
 */
router.post('/notifications', appleServerNotificationController);

export default router;

