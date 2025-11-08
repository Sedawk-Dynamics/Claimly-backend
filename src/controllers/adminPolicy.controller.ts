import { Request, Response, NextFunction } from 'express';
import { AdminRequest } from '../middlewares/adminAuth.middleware';
import { getAllPolicies } from '../services/adminPolicy.service';

export const getAllPoliciesController = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string | undefined;

    const result = await getAllPolicies(page, limit, search);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

