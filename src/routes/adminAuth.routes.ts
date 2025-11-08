import { Router } from 'express';
import { adminLoginController } from '../controllers/adminAuth.controller';
import { validateAdminLogin } from '../middlewares/validation.middleware';
import { validate, adminLoginSchema } from '../utils/validation';

const router = Router();

router.post('/login', validate(adminLoginSchema), adminLoginController);

export default router;

