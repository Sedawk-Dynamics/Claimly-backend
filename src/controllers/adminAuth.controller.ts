import { Request, Response, NextFunction } from 'express';
import {
  adminLogin,
  agentSignup,
  agentLogin,
  getAllAgents,
  verifyAgent,
  revokeAgentVerification,
  getOrCreateAgentReferralCode,
  getAgentReferrals,
  rejectAgent,
  deleteAgent,
} from '../services/adminAuth.service';
import { AdminRequest } from '../middlewares/adminAuth.middleware';

export const adminLoginController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
      return;
    }

    const result = await adminLogin({ email, password });
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const agentSignupController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { idToken, name, email, mobileNumber, password } = req.body;

    if (!idToken || !name || !email || !mobileNumber || !password) {
      res.status(400).json({
        success: false,
        error: 'All fields are required: idToken, name, email, mobileNumber, password',
      });
      return;
    }

    const result = await agentSignup({ idToken, name, email, mobileNumber, password });
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const agentLoginController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { idToken, email, password } = req.body;

    if (!idToken || !email || !password) {
      res.status(400).json({
        success: false,
        error: 'idToken, email, and password are required',
      });
      return;
    }

    const result = await agentLogin({ idToken, email, password });
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllAgentsController = async (req: AdminRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Only SUPER_ADMIN and STAFF can view agents
    if (req.admin.role === 'AGENT') {
      res.status(403).json({ error: 'Forbidden: Agents cannot view other agents' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string | undefined;

    const result = await getAllAgents(page, limit, search);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyAgentController = async (req: AdminRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Only SUPER_ADMIN and STAFF can verify agents
    if (req.admin.role === 'AGENT') {
      res.status(403).json({ error: 'Forbidden: Agents cannot verify other agents' });
      return;
    }

    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Agent ID is required',
      });
      return;
    }

    const result = await verifyAgent(id, req.admin.adminId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const revokeAgentVerificationController = async (req: AdminRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Only SUPER_ADMIN and STAFF can revoke agent verification
    if (req.admin.role === 'AGENT') {
      res.status(403).json({ error: 'Forbidden: Agents cannot revoke verification of other agents' });
      return;
    }

    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Agent ID is required',
      });
      return;
    }

    const result = await revokeAgentVerification(id, req.admin.adminId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const rejectAgentController = async (req: AdminRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Only SUPER_ADMIN and STAFF can reject agents
    if (req.admin.role === 'AGENT') {
      res.status(403).json({ error: 'Forbidden: Agents cannot reject other agents' });
      return;
    }

    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Agent ID is required',
      });
      return;
    }

    await rejectAgent(id, req.admin.adminId);
    res.status(200).json({
      success: true,
      data: { id, status: 'rejected' },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAgentController = async (req: AdminRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Only SUPER_ADMIN and STAFF can delete agents
    if (req.admin.role === 'AGENT') {
      res.status(403).json({ error: 'Forbidden: Agents cannot delete other agents' });
      return;
    }

    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Agent ID is required',
      });
      return;
    }

    await deleteAgent(id, req.admin.adminId);
    res.status(200).json({
      success: true,
      data: { id, status: 'deleted' },
    });
  } catch (error) {
    next(error);
  }
};

export const getAgentReferralCodeController = async (req: AdminRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await getOrCreateAgentReferralCode(req.admin.adminId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAgentReferralsController = async (req: AdminRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await getAgentReferrals(req.admin.adminId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

