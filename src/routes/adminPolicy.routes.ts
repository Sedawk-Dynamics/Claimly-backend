import { Router } from 'express';
import { authenticateAdmin, requireVerifiedAgent } from '../middlewares/adminAuth.middleware';
import { getAllPoliciesController, acceptPolicyController, rejectPolicyController } from '../controllers/adminPolicy.controller';

const router = Router();

// All admin policy routes require authentication and verified agent status
router.use(authenticateAdmin);
router.use(requireVerifiedAgent);

router.get('/', getAllPoliciesController);
router.post('/:id/accept', acceptPolicyController);
router.post('/:id/reject', rejectPolicyController);

export default router;

