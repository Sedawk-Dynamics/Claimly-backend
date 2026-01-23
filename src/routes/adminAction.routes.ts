import { Router } from 'express';
import { authenticateAdmin, requireVerifiedAgent } from '../middlewares/adminAuth.middleware';
import {
  createAdminActionController,
  getAllAdminActionsController,
  getAdminActionByIdController,
} from '../controllers/adminAction.controller';

const router = Router();

// All admin action routes require authentication and verified agent status
router.use(authenticateAdmin);
router.use(requireVerifiedAgent);

router.post('/', createAdminActionController);
router.get('/', getAllAdminActionsController);
router.get('/:id', getAdminActionByIdController);

export default router;

