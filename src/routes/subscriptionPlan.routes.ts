import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authenticateAdmin } from '../middlewares/adminAuth.middleware';
import {
  getActivePlansController,
  getAllPlansController,
  getPlanByIdController,
  createPlanController,
  updatePlanController,
  deletePlanController,
} from '../controllers/subscriptionPlan.controller';

const router = Router();

// Public route for users to get active plans (requires user authentication)
router.get('/active', authenticate, getActivePlansController);

// Admin routes
router.use('/admin', authenticateAdmin);

router.get('/admin', getAllPlansController);
router.get('/admin/:id', getPlanByIdController);
router.post('/admin', createPlanController);
router.put('/admin/:id', updatePlanController);
router.delete('/admin/:id', deletePlanController);

export default router;
