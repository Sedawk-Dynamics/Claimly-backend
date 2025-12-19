import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { validate, createSubscriptionSchema } from '../utils/validation';
import { createSubscriptionController } from '../controllers/subscription.controller';
import {
  downloadReceiptController,
  getReceiptURLController,
} from '../controllers/receipt.controller';

const router = Router();

// All subscription routes require authentication
router.use(authenticate);

router.post('/', validate(createSubscriptionSchema), createSubscriptionController);

// Receipt routes
router.get('/:id/receipt', downloadReceiptController);
router.get('/:id/receipt-url', getReceiptURLController);

export default router;

