import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import {
  getUserProfile,
  updateUserProfile,
  getUserSubscriptions,
  getCurrentSubscription,
  getUserById,
  updateUserById,
  getUserKycStatus,
} from '../services/user.service';

export const getProfileController = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const profile = await getUserProfile(req.user.userId);
    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfileController = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, dob, email, deviceId } = req.body;
    const updatedProfile = await updateUserProfile(req.user.userId, {
      name,
      dob,
      email,
      deviceId,
    });

    res.status(200).json({
      success: true,
      data: updatedProfile,
    });
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionController = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get query parameter to determine if we want all subscriptions or just current
    const { all } = req.query;

    if (all === 'true') {
      const subscriptions = await getUserSubscriptions(req.user.userId);
      res.status(200).json({
        success: true,
        data: subscriptions,
      });
    } else {
      const currentSubscription = await getCurrentSubscription(req.user.userId);
      res.status(200).json({
        success: true,
        data: currentSubscription,
      });
    }
  } catch (error) {
    next(error);
  }
};

export const getUserByIdController = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const user = await getUserById(id);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserByIdController = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { name, dob, email, deviceId } = req.body;
    const updatedUser = await updateUserById(id, {
      name,
      dob,
      email,
      deviceId,
    });

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

export const getKycStatusController = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const status = await getUserKycStatus(req.user.userId);
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
};


