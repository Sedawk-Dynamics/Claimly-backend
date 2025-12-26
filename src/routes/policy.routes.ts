import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { validate, createPolicySchema, updatePolicySchema, createPolicyDraftSchema } from '../utils/validation';
import { requireActiveSubscription, requireCompletedKyc } from '../middlewares/subscription.middleware';
import {
  createPolicyController,
  createPolicyDraftController,
  getPoliciesController,
  getPolicyByIdController,
  updatePolicyController,
  deletePolicyController,
  markPolicyDraftController,
} from '../controllers/policy.controller';

const router = Router();

// All policy routes require authentication and active subscription
router.use(authenticate);
router.use(requireActiveSubscription);

router.post('/draft', requireCompletedKyc, validate(createPolicyDraftSchema), createPolicyDraftController);
router.post('/', requireCompletedKyc, validate(createPolicySchema), createPolicyController);
router.get('/', getPoliciesController);
router.get('/:id', getPolicyByIdController);
router.put('/:id/draft', markPolicyDraftController);
router.put('/:id', validate(updatePolicySchema), updatePolicyController);
router.delete('/:id', deletePolicyController);

export default router;

