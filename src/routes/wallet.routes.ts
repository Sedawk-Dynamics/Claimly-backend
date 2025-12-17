import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import {
  getWalletBalanceController,
  getWalletTransactionsController,
  getWalletEligibilityController,
} from '../controllers/wallet.controller';

const router = Router();

// All wallet routes require authentication
router.use(authenticate);

router.get('/balance', getWalletBalanceController);
router.get('/transactions', getWalletTransactionsController);
router.get('/eligibility', getWalletEligibilityController);

export default router;

