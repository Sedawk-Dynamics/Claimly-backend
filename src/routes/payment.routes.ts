import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import {
  validate,
  createPaymentOrderSchema,
  verifyPaymentSchema,
  verifyAppleIapSchema,
} from '../utils/validation';
import {
  createPaymentOrderController,
  verifyPaymentController,
  verifyAppleIapController,
} from '../controllers/payment.controller';

const router = Router();

// All payment routes require authentication
router.use(authenticate);

// ----- Razorpay (Android / Web) – unchanged -----
router.post('/create-order', validate(createPaymentOrderSchema), createPaymentOrderController);
router.post('/verify', validate(verifyPaymentSchema), verifyPaymentController);

// ----- Apple In-App Purchase (iOS) – second option -----
router.post('/apple-verify', validate(verifyAppleIapSchema), verifyAppleIapController);

export default router;
