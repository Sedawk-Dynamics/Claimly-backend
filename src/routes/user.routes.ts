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
  uploadProfilePictureController,
} from '../controllers/user.controller';
import { singleProfilePictureUpload } from '../utils/fileUpload';

const router = Router();

// All user routes require authentication
router.use(authenticate);

router.get('/profile', getProfileController);
router.put('/profile', validateUpdateProfile, updateProfileController);
router.post('/profile/picture', singleProfilePictureUpload, uploadProfilePictureController);
router.get('/subscription', getSubscriptionController);
router.get('/kyc-status', getKycStatusController);
router.post('/referral-code', generateReferralCodeController);
router.post('/fcm-token', registerFCMTokenController);
router.delete('/fcm-token', unregisterFCMTokenController);
router.get('/:id', validate(getUserByIdSchema), getUserByIdController);
router.put('/:id', validate(updateUserByIdSchema), updateUserByIdController);

export default router;

