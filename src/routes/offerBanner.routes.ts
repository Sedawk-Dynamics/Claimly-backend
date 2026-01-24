import { Router } from 'express';
import { authenticateAdmin, requireVerifiedAgent } from '../middlewares/adminAuth.middleware';
import {
  uploadOfferBannerController,
  getAllOfferBannersController,
  getOfferBannerByIdController,
  updateOfferBannerController,
  deleteOfferBannerController,
  getActiveOfferBannerController,
} from '../controllers/offerBanner.controller';
import { singleOfferBannerUpload } from '../utils/fileUpload';

const router = Router();

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================
// Get active offer banner - accessible without login/signup
router.get('/active', getActiveOfferBannerController);

// ============================================
// ADMIN ROUTES (Authentication required)
// ============================================
// All routes below require admin authentication and verified agent status
router.use(authenticateAdmin);
router.use(requireVerifiedAgent);

router.post('/', singleOfferBannerUpload, uploadOfferBannerController);
router.get('/', getAllOfferBannersController);
router.get('/:id', getOfferBannerByIdController);
router.put('/:id', updateOfferBannerController);
router.delete('/:id', deleteOfferBannerController);

export default router;

