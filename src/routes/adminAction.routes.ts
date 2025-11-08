import { Router } from 'express';
import { authenticateAdmin } from '../middlewares/adminAuth.middleware';
import {
  createAdminActionController,
  getAllAdminActionsController,
  getAdminActionByIdController,
} from '../controllers/adminAction.controller';

const router = Router();

// All admin action routes require authentication
router.use(authenticateAdmin);

router.post('/', createAdminActionController);
router.get('/', getAllAdminActionsController);
router.get('/:id', getAdminActionByIdController);

export default router;

