import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { validate, linkNomineeSchema, updateNomineeShareSchema } from '../utils/validation';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';
import {
  linkNomineeController,
  updateNomineeShareController,
  unlinkNomineeController,
  getPolicyNomineesController,
} from '../controllers/policyNominee.controller';

const router = Router();

// All policy-nominee routes require authentication and active subscription
router.use(authenticate);
router.use(requireActiveSubscription);

// Get all nominees for a policy
router.get('/:policyId', getPolicyNomineesController);

// Link nominee to policy
router.post('/:policyId/nominee', validate(linkNomineeSchema), linkNomineeController);

// Update nominee share percentage
router.put('/:policyId/nominee/:nomineeId', validate(updateNomineeShareSchema), updateNomineeShareController);

// Unlink nominee from policy
router.delete('/:policyId/nominee/:nomineeId', unlinkNomineeController);

export default router;

