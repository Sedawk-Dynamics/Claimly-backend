import { Router } from 'express';
import { authenticateAdmin, requireVerifiedAgent } from '../middlewares/adminAuth.middleware';
import {
  createCompanyController,
  getAllCompaniesController,
  getCompanyByIdController,
  updateCompanyController,
  deleteCompanyController,
} from '../controllers/adminCompany.controller';

const router = Router();

// All admin company routes require authentication and verified agent status
router.use(authenticateAdmin);
router.use(requireVerifiedAgent);

router.post('/', createCompanyController);
router.get('/', getAllCompaniesController);
router.get('/:id', getCompanyByIdController);
router.put('/:id', updateCompanyController);
router.delete('/:id', deleteCompanyController);

export default router;

