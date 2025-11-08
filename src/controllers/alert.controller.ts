import { Request, Response, NextFunction } from 'express';
import { createAlert, verifyAlert, getAlertById } from '../services/alert.service';
import { AdminRequest } from '../middlewares/adminAuth.middleware';

export const createAlertController = async (
  req: Request | AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId, detectedVia, detectionDate, remarks } = req.body;

    // If called by admin (has admin property), allow manual creation
    // If called by system, detectedVia should be SMS
    const alert = await createAlert({
      userId,
      detectedVia,
      detectionDate,
      remarks,
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

