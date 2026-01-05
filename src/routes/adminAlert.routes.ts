import { Router } from 'express';
import { authenticateAdmin } from '../middlewares/adminAuth.middleware';
import {
  getAllAlertsController,
  getAlertByIdController,
  verifyAlertController,
  getAlertStatsController,
  bulkVerifyAlertsController,
  deleteAlertController,
} from '../controllers/adminAlert.controller';

const router = Router();

// All admin alert routes require authentication
router.use(authenticateAdmin);

router.get('/stats', getAlertStatsController);
router.get('/', getAllAlertsController);
router.post('/bulk-verify', bulkVerifyAlertsController);
router.get('/:id', getAlertByIdController);
router.put('/:id/verify', verifyAlertController);
router.delete('/:id', deleteAlertController);

export default router;

