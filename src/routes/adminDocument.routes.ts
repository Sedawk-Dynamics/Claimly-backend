import { Router } from 'express';
import { authenticateAdmin, requireVerifiedAgent } from '../middlewares/adminAuth.middleware';
import { validate, verifyDocumentSchema, rejectDocumentSchema } from '../utils/validation';
import { verifyDocumentController, rejectDocumentController, getKycDocumentsController, getPolicyDocumentsController, getNomineeDocumentsController, acceptEntityWithoutDocumentsController, rejectEntityWithoutDocumentsController, deleteDocumentByAdminController, deleteKycDocumentsByAdminController, deleteUserByAdminController, deletePolicyByAdminController, deleteNomineeByAdminController, verifyEntityDetailsController } from '../controllers/adminDocument.controller';

const router = Router();

// All admin document routes require authentication and verified agent status
router.use(authenticateAdmin);
router.use(requireVerifiedAgent);

router.get('/', getKycDocumentsController);
router.get('/kyc-documents', getKycDocumentsController);
router.get('/policy-documents', getPolicyDocumentsController);
router.get('/nominee-documents', getNomineeDocumentsController);
router.patch('/verify-document/:id', validate(verifyDocumentSchema), verifyDocumentController);
router.patch('/reject-document/:id', validate(rejectDocumentSchema), rejectDocumentController);
router.post('/verify-details/:id', verifyEntityDetailsController);
router.delete('/document/:id', deleteDocumentByAdminController);
router.delete('/kyc/:id', deleteKycDocumentsByAdminController);
router.delete('/user/:id', deleteUserByAdminController);
router.delete('/policy/:id', deletePolicyByAdminController);
router.delete('/nominee/:id', deleteNomineeByAdminController);
router.post('/accept-entity/:id', acceptEntityWithoutDocumentsController);
router.post('/reject-entity/:id', rejectEntityWithoutDocumentsController);

export default router;

