import { Router } from 'express';
import { authenticateAdmin, requireVerifiedAgent } from '../middlewares/adminAuth.middleware';
import {
  uploadBannerController,
  getAllBannersController,
  getBannerByIdController,
  updateBannerController,
  deleteBannerController,
  getActiveBannerController,
} from '../controllers/banner.controller';
import { singleBannerUpload } from '../utils/fileUpload';

const router = Router();

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================
// Get active banner - accessible without login/signup
router.get('/active', getActiveBannerController);

// ============================================
// ADMIN ROUTES (Authentication required)
// ============================================
// All routes below require admin authentication and verified agent status
router.use(authenticateAdmin);
router.use(requireVerifiedAgent);

router.post('/', singleBannerUpload, uploadBannerController);
router.get('/', getAllBannersController);
router.get('/:id', getBannerByIdController);
router.put('/:id', updateBannerController);
router.delete('/:id', deleteBannerController);

export default router;
