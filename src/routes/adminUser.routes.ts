import { Router } from 'express';
import { authenticateAdmin } from '../middlewares/adminAuth.middleware';
import {
  getAllUsersController,
  getUserByIdController,
  updateUserStatusController,
} from '../controllers/adminUser.controller';
import { getUserActivityLogsController, deleteActivityLogController, deleteAllActivityLogsController } from '../controllers/adminUserActivity.controller';

const router = Router();

// All admin user routes require authentication
router.use(authenticateAdmin);

router.get('/', getAllUsersController);
router.get('/:id', getUserByIdController);
router.get('/:id/activity-logs', getUserActivityLogsController);
router.put('/:id/status', updateUserStatusController);
router.delete('/activity-logs/:logId', deleteActivityLogController);
router.delete('/:id/activity-logs', deleteAllActivityLogsController);

export default router;

