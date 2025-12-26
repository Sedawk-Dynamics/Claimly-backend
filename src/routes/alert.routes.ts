import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authenticateAdmin } from '../middlewares/adminAuth.middleware';
import { validate, createAlertSchema, verifyAlertSchema } from '../utils/validation';
import {
  createAlertController,
  verifyAlertController,
  getAlertByIdController,
} from '../controllers/alert.controller';

const router = Router();

// Create alert - requires user authentication (from mobile app)
router.post('/', authenticate, validate(createAlertSchema), createAlertController);

// Get alert by ID - accessible by admin or authenticated user
router.get('/:id', getAlertByIdController);

// Verify alert - admin only
router.patch('/:id/verify', authenticateAdmin, validate(verifyAlertSchema), verifyAlertController);

export default router;

