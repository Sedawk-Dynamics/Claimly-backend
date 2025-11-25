import { Router } from 'express';
import { verifyOTPController } from '../controllers/auth.controller';
import { validateVerifyOTP } from '../middlewares/validation.middleware';
import { validate, verifyOTPSchema } from '../utils/validation';

const router = Router();

// Use Zod validation (can replace or use alongside existing validation)
router.post('/register', validate(verifyOTPSchema), verifyOTPController);

export default router;

