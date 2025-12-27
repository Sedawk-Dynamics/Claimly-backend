import { Router } from 'express';
import { authenticateAdmin } from '../middlewares/adminAuth.middleware';
import { validate, verifyDocumentSchema, rejectDocumentSchema } from '../utils/validation';
import { verifyDocumentController, rejectDocumentController, getKycDocumentsController, getPolicyDocumentsController, getNomineeDocumentsController, acceptEntityWithoutDocumentsController, rejectEntityWithoutDocumentsController, deleteDocumentByAdminController } from '../controllers/adminDocument.controller';

const router = Router();

// All admin document routes require authentication
router.use(authenticateAdmin);

router.get('/', getKycDocumentsController);
router.get('/kyc-documents', getKycDocumentsController);
router.get('/policy-documents', getPolicyDocumentsController);
router.get('/nominee-documents', getNomineeDocumentsController);
router.patch('/verify-document/:id', validate(verifyDocumentSchema), verifyDocumentController);
router.patch('/reject-document/:id', validate(rejectDocumentSchema), rejectDocumentController);
router.delete('/document/:id', deleteDocumentByAdminController);
router.post('/accept-entity/:id', acceptEntityWithoutDocumentsController);
router.post('/reject-entity/:id', rejectEntityWithoutDocumentsController);

export default router;

