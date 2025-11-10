import { Router } from 'express';
import { authenticateAdmin } from '../middlewares/adminAuth.middleware';
import { validate, verifyDocumentSchema, rejectDocumentSchema } from '../utils/validation';
import { verifyDocumentController, rejectDocumentController, getKycDocumentsController } from '../controllers/adminDocument.controller';

const router = Router();

// All admin document routes require authentication
router.use(authenticateAdmin);

router.get('/', getKycDocumentsController);
router.get('/kyc-documents', getKycDocumentsController);
router.patch('/verify-document/:id', validate(verifyDocumentSchema), verifyDocumentController);
router.patch('/reject-document/:id', validate(rejectDocumentSchema), rejectDocumentController);

export default router;

