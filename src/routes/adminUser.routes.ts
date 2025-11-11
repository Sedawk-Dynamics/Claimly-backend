import { Router } from 'express';
import { authenticateAdmin } from '../middlewares/adminAuth.middleware';
import {
  getAllUsersController,
  getUserByIdController,
  updateUserStatusController,
} from '../controllers/adminUser.controller';
import { getUserActivityLogsController } from '../controllers/adminUserActivity.controller';

const router = Router();

// All admin user routes require authentication
router.use(authenticateAdmin);

router.get('/', getAllUsersController);
router.get('/:id', getUserByIdController);
router.get('/:id/activity-logs', getUserActivityLogsController);
router.put('/:id/status', updateUserStatusController);

export default router;

