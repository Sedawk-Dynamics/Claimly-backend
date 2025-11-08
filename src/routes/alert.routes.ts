import { Router } from 'express';
import { authenticateAdmin } from '../middlewares/adminAuth.middleware';
import { validateCreateAlert, validateVerifyAlert } from '../middlewares/validation.middleware';
import { validate, createAlertSchema, verifyAlertSchema } from '../utils/validation';
import {
  createAlertController,
  verifyAlertController,
  getAlertByIdController,
} from '../controllers/alert.controller';

const router = Router();

// Create alert - can be called by system (SMS) or admin (manual)
// For system calls, no auth required (or use service account)
// For admin calls, require admin auth
router.post('/', validate(createAlertSchema), createAlertController);

// Get alert by ID - accessible by admin or system
router.get('/:id', getAlertByIdController);

// Verify alert - admin only
router.patch('/:id/verify', authenticateAdmin, validate(verifyAlertSchema), verifyAlertController);

export default router;

