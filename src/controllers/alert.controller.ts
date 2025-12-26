import { Request, Response, NextFunction } from 'express';
import { createAlert, verifyAlert, getAlertById } from '../services/alert.service';
import { AdminRequest } from '../middlewares/adminAuth.middleware';
import { AuthRequest } from '../middlewares/auth.middleware';

export const createAlertController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { smsText, detectionDate } = req.body;

    // Use authenticated user's ID
    const alert = await createAlert({
      userId: req.user.userId,
      smsText,
      detectionDate,
    });

    res.status(201).json({
      success: true,
      data: alert,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyAlertController = async (
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
    const { verificationStatus, remarks } = req.body;

    const result = await verifyAlert(req.admin.adminId, id, {
      verificationStatus,
      remarks,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAlertByIdController = async (
  req: Request | AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const alert = await getAlertById(id);
    res.status(200).json({
      success: true,
      data: alert,
    });
  } catch (error) {
    next(error);
  }
};

