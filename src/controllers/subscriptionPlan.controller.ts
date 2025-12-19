import { Response, NextFunction } from 'express';
import { AdminRequest } from '../middlewares/adminAuth.middleware';
import { AuthRequest } from '../middlewares/auth.middleware';
import {
  getActiveSubscriptionPlans,
  getAllSubscriptionPlans,
  getSubscriptionPlanById,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
} from '../services/subscriptionPlan.service';

/**
 * Get active subscription plans (public endpoint for users)
 */
export const getActivePlansController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const plans = await getActiveSubscriptionPlans();
    res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all subscription plans (admin only)
 */
export const getAllPlansController = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const plans = await getAllSubscriptionPlans();
    res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get subscription plan by ID (admin only)
 */
export const getPlanByIdController = async (
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
    const plan = await getSubscriptionPlanById(id);
    res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create subscription plan (admin only)
 */
export const createPlanController = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, price, features, isPopular, status } = req.body;

    if (!name || !price || !features) {
      res.status(400).json({ error: 'Name, price, and features are required' });
      return;
    }

    const plan = await createSubscriptionPlan({
      name,
      price: parseFloat(price),
      features: Array.isArray(features) ? features : [],
      isPopular: isPopular || false,
      status: status || 'ACTIVE',
    });

    res.status(201).json({
      success: true,
      data: plan,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update subscription plan (admin only)
 */
export const updatePlanController = async (
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
    const { name, price, features, isPopular, status } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (features !== undefined) updateData.features = Array.isArray(features) ? features : [];
    if (isPopular !== undefined) updateData.isPopular = isPopular;
    if (status !== undefined) updateData.status = status;

    const plan = await updateSubscriptionPlan(id, updateData);

    res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete subscription plan (admin only)
 */
export const deletePlanController = async (
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
    await deleteSubscriptionPlan(id);

    res.status(200).json({
      success: true,
      message: 'Subscription plan deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
