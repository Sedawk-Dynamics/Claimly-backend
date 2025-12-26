import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { validate, createNomineeSchema, createNomineeDraftSchema } from '../utils/validation';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';
import { multipleNomineeFileUpload } from '../utils/fileUpload';
import {
  createNomineeController,
  createNomineeDraftController,
  getNomineesController,
  getNomineeByIdController,
  updateNomineeController,
  deleteNomineeController,
} from '../controllers/nominee.controller';

const router = Router();

// All nominee routes require authentication and active subscription
router.use(authenticate);
router.use(requireActiveSubscription);

router.post('/draft', validate(createNomineeDraftSchema), createNomineeDraftController);
router.post('/', validate(createNomineeSchema), createNomineeController);
router.get('/', getNomineesController);
router.get('/:id', getNomineeByIdController);
router.put('/:id', multipleNomineeFileUpload, updateNomineeController);
router.delete('/:id', deleteNomineeController);

export default router;

