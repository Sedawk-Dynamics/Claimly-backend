import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { validate, createSubscriptionSchema } from '../utils/validation';
import { createSubscriptionController } from '../controllers/subscription.controller';

const router = Router();

// All subscription routes require authentication
router.use(authenticate);

router.post('/', validate(createSubscriptionSchema), createSubscriptionController);

export default router;

