import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { validate, createNomineeSchema, updateNomineeSchema } from '../utils/validation';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';
import {
  createNomineeController,
  getNomineesController,
  getNomineeByIdController,
  updateNomineeController,
  deleteNomineeController,
} from '../controllers/nominee.controller';

const router = Router();

// All nominee routes require authentication and active subscription
router.use(authenticate);
router.use(requireActiveSubscription);

router.post('/', validate(createNomineeSchema), createNomineeController);
router.get('/', getNomineesController);
router.get('/:id', getNomineeByIdController);
router.put('/:id', validate(updateNomineeSchema), updateNomineeController);
router.delete('/:id', deleteNomineeController);

export default router;

