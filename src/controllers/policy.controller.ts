import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import {
  createPolicy,
  createPolicyDraft,
  getUserPolicies,
  getPolicyById,
  updatePolicy,
  deletePolicy,
} from '../services/policy.service';

export const createPolicyController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { insuranceCompanyId, policyNumber, sumAssured } = req.body;
    const isDraft = !policyNumber || !sumAssured;

    const policy = isDraft
      ? await createPolicyDraft(req.user.userId, {
          insuranceCompanyId,
          policyNumber,
          sumAssured,
        })
      : await createPolicy(req.user.userId, {
          insuranceCompanyId,
          policyNumber: policyNumber!,
          sumAssured: sumAssured!,
        });

    res.status(201).json({
      success: true,
      data: policy,
    });
  } catch (error) {
    next(error);
  }
};

export const getPoliciesController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const policies = await getUserPolicies(req.user.userId);
    res.status(200).json({
      success: true,
      data: policies,
    });
  } catch (error) {
    next(error);
  }
};

export const getPolicyByIdController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const policy = await getPolicyById(req.user.userId, id);
    res.status(200).json({
      success: true,
      data: policy,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePolicyController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { insuranceCompanyId, policyNumber, sumAssured, status } = req.body;
    const updatedPolicy = await updatePolicy(req.user.userId, id, {
      insuranceCompanyId,
      policyNumber,
      sumAssured,
      status,
    });

    res.status(200).json({
      success: true,
      data: updatedPolicy,
    });
  } catch (error) {
    next(error);
  }
};

export const deletePolicyController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const result = await deletePolicy(req.user.userId, id);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

