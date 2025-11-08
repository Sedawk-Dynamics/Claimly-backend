import { Router } from 'express';
import { authenticateAdmin } from '../middlewares/adminAuth.middleware';
import { getAllPoliciesController } from '../controllers/adminPolicy.controller';

const router = Router();

// All admin policy routes require authentication
router.use(authenticateAdmin);

router.get('/', getAllPoliciesController);

export default router;

