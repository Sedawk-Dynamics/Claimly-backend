import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { validate, createPaymentOrderSchema, verifyPaymentSchema } from '../utils/validation';
import {
  createPaymentOrderController,
  verifyPaymentController,
} from '../controllers/payment.controller';

const router = Router();

// All payment routes require authentication
router.use(authenticate);

// Create Razorpay order
router.post('/create-order', validate(createPaymentOrderSchema), createPaymentOrderController);

// Verify payment and create subscription
router.post('/verify', validate(verifyPaymentSchema), verifyPaymentController);

export default router;
