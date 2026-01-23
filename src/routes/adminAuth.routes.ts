import { Router } from 'express';
import { 
  adminLoginController, 
  agentSignupController, 
  agentLoginController,
  getAllAgentsController,
  verifyAgentController,
  revokeAgentVerificationController,
  getAgentReferralCodeController,
  getAgentReferralsController,
  rejectAgentController,
  deleteAgentController,
} from '../controllers/adminAuth.controller';
import { validate, adminLoginSchema, agentSignupSchema, agentLoginSchema } from '../utils/validation';
import { authenticateAdmin, requireVerifiedAgent } from '../middlewares/adminAuth.middleware';

const router = Router();

// Admin login
router.post('/login', validate(adminLoginSchema), adminLoginController);

// Agent signup (public, but requires OTP verification)
router.post('/agent/signup', validate(agentSignupSchema), agentSignupController);

// Agent login (public, but requires OTP verification)
router.post('/agent/login', validate(agentLoginSchema), agentLoginController);

// Get all agents (requires admin authentication)
router.get('/agents', authenticateAdmin, getAllAgentsController);

// Verify agent (requires admin authentication)
router.post('/agents/:id/verify', authenticateAdmin, verifyAgentController);

// Revoke agent verification (requires admin authentication)
router.post('/agents/:id/revoke-verification', authenticateAdmin, revokeAgentVerificationController);

// Reject pending agent (requires admin authentication)
router.post('/agents/:id/reject', authenticateAdmin, rejectAgentController);

// Delete agent (requires admin authentication)
router.delete('/agents/:id', authenticateAdmin, deleteAgentController);

// Agent self referral info (requires authenticated & verified AGENT)
router.get('/agent/me/referral-code', authenticateAdmin, requireVerifiedAgent, getAgentReferralCodeController);
router.get('/agent/me/referrals', authenticateAdmin, requireVerifiedAgent, getAgentReferralsController);

export default router;

