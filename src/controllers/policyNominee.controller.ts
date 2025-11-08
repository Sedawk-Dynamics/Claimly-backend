import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import {
  linkNomineeToPolicy,
  updateNomineeShare,
  unlinkNomineeFromPolicy,
  getPolicyNominees,
} from '../services/policyNominee.service';

export const linkNomineeController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { policyId } = req.params;
    const { nomineeId, sharePercentage } = req.body;
    const link = await linkNomineeToPolicy(req.user.userId, policyId, {
      nomineeId,
      sharePercentage,
    });

    res.status(201).json({
      success: true,
      data: link,
    });
  } catch (error) {
    next(error);
  }
};

export const updateNomineeShareController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { policyId, nomineeId } = req.params;
    const { sharePercentage } = req.body;
    const updatedLink = await updateNomineeShare(
      req.user.userId,
      policyId,
      nomineeId,
      sharePercentage
    );

    res.status(200).json({
      success: true,
      data: updatedLink,
    });
  } catch (error) {
    next(error);
  }
};

export const unlinkNomineeController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { policyId, nomineeId } = req.params;
    const result = await unlinkNomineeFromPolicy(req.user.userId, policyId, nomineeId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getPolicyNomineesController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { policyId } = req.params;
    const result = await getPolicyNominees(req.user.userId, policyId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

