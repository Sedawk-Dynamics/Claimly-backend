import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { singleUserFileUpload } from '../utils/fileUpload';
import {
  uploadDocumentController,
  getDocumentsController,
  getDocumentByIdController,
  deleteDocumentController,
} from '../controllers/userDocument.controller';

const router = Router();

// All user document routes require authentication
router.use(authenticate);

router.post('/', singleUserFileUpload, uploadDocumentController);
router.get('/', getDocumentsController);
router.get('/:id', getDocumentByIdController);
router.delete('/:id', deleteDocumentController);

export default router;

