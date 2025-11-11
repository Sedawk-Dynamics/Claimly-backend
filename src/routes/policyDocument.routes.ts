import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { singlePolicyFileUpload } from '../utils/fileUpload';
import {
  uploadDocumentController,
  getDocumentsController,
  getDocumentByIdController,
  updateDocumentController,
  deleteDocumentController,
} from '../controllers/policyDocument.controller';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';

const router = Router();

// All policy document routes require authentication and active subscription
router.use(authenticate);
router.use(requireActiveSubscription);

router.post('/:policyId/document', singlePolicyFileUpload, uploadDocumentController);
router.get('/:policyId/document', getDocumentsController);
router.get('/:policyId/document/:documentId', getDocumentByIdController);
router.put('/:policyId/document/:documentId', singlePolicyFileUpload, updateDocumentController);
router.delete('/:policyId/document/:documentId', deleteDocumentController);

export default router;

