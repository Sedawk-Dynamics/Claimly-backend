import { Response, NextFunction } from 'express';
import { AdminRequest } from '../middlewares/adminAuth.middleware';
import { createAdminAction, getAllAdminActions, getAdminActionById } from '../services/adminAction.service';

export const createAdminActionController = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { userId, actionType, notes } = req.body;
    const action = await createAdminAction(req.admin.adminId, { userId, actionType, notes });
    res.status(201).json({
      success: true,
      data: action,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllAdminActionsController = async (
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
    const adminId = req.query.adminId as string | undefined;
    const userId = req.query.userId as string | undefined;
    const actionType = req.query.actionType as string | undefined;

    const result = await getAllAdminActions(page, limit, adminId, userId, actionType);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminActionByIdController = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const action = await getAdminActionById(id);
    res.status(200).json({
      success: true,
      data: action,
    });
  } catch (error) {
    next(error);
  }
};

