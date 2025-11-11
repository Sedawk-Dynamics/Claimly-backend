import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { singleUserFileUpload } from '../utils/fileUpload';
import {
  uploadDocumentController,
  getDocumentsController,
  getDocumentByIdController,
  updateDocumentController,
  deleteDocumentController,
} from '../controllers/userDocument.controller';

const router = Router();

// All user document routes require authentication
router.use(authenticate);

router.post('/', singleUserFileUpload, uploadDocumentController);
router.get('/', getDocumentsController);
router.get('/:id', getDocumentByIdController);
router.put('/:id', singleUserFileUpload, updateDocumentController);
router.delete('/:id', deleteDocumentController);

export default router;

