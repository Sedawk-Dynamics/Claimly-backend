import { Router } from 'express';
import { authenticateAdmin, requireVerifiedAgent } from '../middlewares/adminAuth.middleware';
import {
  getAllAlertsController,
  getAlertByIdController,
  verifyAlertController,
  getAlertStatsController,
  bulkVerifyAlertsController,
  deleteAlertController,
} from '../controllers/adminAlert.controller';

const router = Router();

// All admin alert routes require authentication and verified agent status
router.use(authenticateAdmin);
router.use(requireVerifiedAgent);

router.get('/stats', getAlertStatsController);
router.get('/', getAllAlertsController);
router.post('/bulk-verify', bulkVerifyAlertsController);
router.get('/:id', getAlertByIdController);
router.put('/:id/verify', verifyAlertController);
router.delete('/:id', deleteAlertController);

export default router;

