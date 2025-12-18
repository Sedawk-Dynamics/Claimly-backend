import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { validateUpdateProfile } from '../middlewares/validation.middleware';
import { validate, getUserByIdSchema, updateUserByIdSchema } from '../utils/validation';
import {
  getProfileController,
  updateProfileController,
  getSubscriptionController,
  getUserByIdController,
  updateUserByIdController,
  getKycStatusController,
  generateReferralCodeController,
  registerFCMTokenController,
  unregisterFCMTokenController,
} from '../controllers/user.controller';

const router = Router();

// All user routes require authentication
router.use(authenticate);

router.get('/profile', getProfileController);
router.put('/profile', validateUpdateProfile, updateProfileController);
router.get('/subscription', getSubscriptionController);
router.get('/kyc-status', getKycStatusController);
router.post('/referral-code', generateReferralCodeController);
router.post('/fcm-token', registerFCMTokenController);
router.delete('/fcm-token', unregisterFCMTokenController);
router.get('/:id', validate(getUserByIdSchema), getUserByIdController);
router.put('/:id', validate(updateUserByIdSchema), updateUserByIdController);

export default router;

