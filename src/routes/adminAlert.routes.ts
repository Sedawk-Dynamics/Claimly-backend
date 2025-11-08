import { Router } from 'express';
import { authenticateAdmin } from '../middlewares/adminAuth.middleware';
import {
  getAllAlertsController,
  getAlertByIdController,
  verifyAlertController,
  getAlertStatsController,
} from '../controllers/adminAlert.controller';

const router = Router();

// All admin alert routes require authentication
router.use(authenticateAdmin);

router.get('/stats', getAlertStatsController);
router.get('/', getAllAlertsController);
router.get('/:id', getAlertByIdController);
router.put('/:id/verify', verifyAlertController);

export default router;

