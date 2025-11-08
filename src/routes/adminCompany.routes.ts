import { Router } from 'express';
import { authenticateAdmin } from '../middlewares/adminAuth.middleware';
import {
  createCompanyController,
  getAllCompaniesController,
  getCompanyByIdController,
  updateCompanyController,
  deleteCompanyController,
} from '../controllers/adminCompany.controller';

const router = Router();

// All admin company routes require authentication
router.use(authenticateAdmin);

router.post('/', createCompanyController);
router.get('/', getAllCompaniesController);
router.get('/:id', getCompanyByIdController);
router.put('/:id', updateCompanyController);
router.delete('/:id', deleteCompanyController);

export default router;

