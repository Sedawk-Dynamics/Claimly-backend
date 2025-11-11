import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { singleNomineeFileUpload } from '../utils/fileUpload';
import {
  uploadDocumentController,
  getDocumentsController,
  getDocumentByIdController,
  updateDocumentController,
  deleteDocumentController,
} from '../controllers/nomineeDocument.controller';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';

const router = Router();

// All nominee document routes require authentication and active subscription
router.use(authenticate);
router.use(requireActiveSubscription);

router.post('/:nomineeId/document', singleNomineeFileUpload, uploadDocumentController);
router.get('/:nomineeId/document', getDocumentsController);
router.get('/:nomineeId/document/:documentId', getDocumentByIdController);
router.put('/:nomineeId/document/:documentId', singleNomineeFileUpload, updateDocumentController);
router.delete('/:nomineeId/document/:documentId', deleteDocumentController);

export default router;

