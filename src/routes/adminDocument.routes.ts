import { Router } from 'express';
import { authenticateAdmin } from '../middlewares/adminAuth.middleware';
import { validate, verifyDocumentSchema } from '../utils/validation';
import { verifyDocumentController, getKycDocumentsController } from '../controllers/adminDocument.controller';

const router = Router();

// All admin document routes require authentication
router.use(authenticateAdmin);

router.get('/', getKycDocumentsController);
router.get('/kyc-documents', getKycDocumentsController);
router.patch('/verify-document/:id', validate(verifyDocumentSchema), verifyDocumentController);

export default router;

