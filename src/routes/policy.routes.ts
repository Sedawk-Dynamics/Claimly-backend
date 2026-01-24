import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { validate, createPolicySchema, updatePolicySchema } from '../utils/validation';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';
import {
  createPolicyController,
  getPoliciesController,
  getPolicyByIdController,
  updatePolicyController,
  deletePolicyController,
} from '../controllers/policy.controller';

const router = Router();

// All policy routes require authentication and active subscription
router.use(authenticate);
router.use(requireActiveSubscription);

router.post('/', validate(createPolicySchema), createPolicyController);
router.get('/', getPoliciesController);
router.get('/:id', getPolicyByIdController);
router.put('/:id', validate(updatePolicySchema), updatePolicyController);
router.delete('/:id', deletePolicyController);

export default router;

