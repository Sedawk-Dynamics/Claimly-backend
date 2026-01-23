import { Router } from 'express';
import { authenticateAdmin, requireVerifiedAgent } from '../middlewares/adminAuth.middleware';
import { validate, verifyDocumentSchema } from '../utils/validation';
import {
  verifyDocumentController,
  getKycDocumentsController,
} from '../controllers/adminDocument.controller';

const router = Router();

// This router provides compatibility endpoints that the documentation references
// (e.g. PATCH /admin/verify-document/:id). It reuses the existing controllers so
// behaviour stays consistent with the canonical /admin/documents routes.

router.use(authenticateAdmin);
router.use(requireVerifiedAgent);

router.get('/kyc-documents', getKycDocumentsController);
router.patch('/verify-document/:id', validate(verifyDocumentSchema), verifyDocumentController);

export default router;


