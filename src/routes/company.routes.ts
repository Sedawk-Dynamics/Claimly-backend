import { Router } from 'express';
import { getCompaniesController } from '../controllers/company.controller';

const router = Router();

router.get('/', getCompaniesController);

export default router;


