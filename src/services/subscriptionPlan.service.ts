import prisma from '../config/prismaClient';
import { NotFoundError, ValidationError } from '../utils/errors';
import logger from '../config/logger';

export interface CreateSubscriptionPlanData {
  name: string;
  price: number;
  features: string[];
  isPopular?: boolean;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface UpdateSubscriptionPlanData {
  name?: string;
  price?: number;
  features?: string[];
  isPopular?: boolean;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: string;
  features: string[];
  isPopular: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

/**
 * Get all active subscription plans (for public user access)
 */
export const getActiveSubscriptionPlans = async (): Promise<SubscriptionPlan[]> => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: {
        status: 'ACTIVE',
      },
      orderBy: [
        { is_popular: 'desc' },
        { created_at: 'asc' },
      ],
    });

    return plans.map((plan) => ({
      id: plan.id.toString(),
      name: plan.name,
      price: plan.price.toString(),
      features: JSON.parse(plan.features) as string[],
      isPopular: plan.is_popular,
      status: plan.status as 'ACTIVE' | 'INACTIVE',
      createdAt: plan.created_at.toISOString(),
      updatedAt: plan.updated_at.toISOString(),
    }));
  } catch (error: any) {
    logger.error('Error fetching active subscription plans', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Get all subscription plans (admin access)
 */
export const getAllSubscriptionPlans = async (): Promise<SubscriptionPlan[]> => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: [
        { is_popular: 'desc' },
        { created_at: 'asc' },
      ],
    });

    return plans.map((plan) => ({
      id: plan.id.toString(),
      name: plan.name,
      price: plan.price.toString(),
      features: JSON.parse(plan.features) as string[],
      isPopular: plan.is_popular,
      status: plan.status as 'ACTIVE' | 'INACTIVE',
      createdAt: plan.created_at.toISOString(),
      updatedAt: plan.updated_at.toISOString(),
    }));
  } catch (error: any) {
    logger.error('Error fetching all subscription plans', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Get subscription plan by ID
 */
export const getSubscriptionPlanById = async (planId: string): Promise<SubscriptionPlan> => {
  try {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: {
        id: BigInt(planId),
      },
    });

    if (!plan) {
      throw new NotFoundError('Subscription plan not found');
    }

    return {
      id: plan.id.toString(),
      name: plan.name,
      price: plan.price.toString(),
      features: JSON.parse(plan.features) as string[],
      isPopular: plan.is_popular,
      status: plan.status as 'ACTIVE' | 'INACTIVE',
      createdAt: plan.created_at.toISOString(),
      updatedAt: plan.updated_at.toISOString(),
    };
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Error fetching subscription plan by ID', {
      error: error.message,
      planId,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Get subscription plan by name
 */
export const getSubscriptionPlanByName = async (planName: string): Promise<SubscriptionPlan | null> => {
  try {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: {
        name: planName,
      },
    });

    if (!plan) {
      return null;
    }

    return {
      id: plan.id.toString(),
      name: plan.name,
      price: plan.price.toString(),
      features: JSON.parse(plan.features) as string[],
      isPopular: plan.is_popular,
      status: plan.status as 'ACTIVE' | 'INACTIVE',
      createdAt: plan.created_at.toISOString(),
      updatedAt: plan.updated_at.toISOString(),
    };
  } catch (error: any) {
    logger.error('Error fetching subscription plan by name', {
      error: error.message,
      planName,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Create a new subscription plan
 */
export const createSubscriptionPlan = async (data: CreateSubscriptionPlanData): Promise<SubscriptionPlan> => {
  try {
    // Validate price
    if (data.price <= 0) {
      throw new ValidationError('Price must be greater than 0');
    }

    // Validate features
    if (!Array.isArray(data.features) || data.features.length === 0) {
      throw new ValidationError('Features must be a non-empty array');
    }

    // Check if plan name already exists
    const existingPlan = await prisma.subscriptionPlan.findUnique({
      where: {
        name: data.name,
      },
    });

    if (existingPlan) {
      throw new ValidationError(`Subscription plan with name "${data.name}" already exists`);
    }

    // If setting this as popular, unset other popular plans
    if (data.isPopular) {
      await prisma.subscriptionPlan.updateMany({
        where: {
          is_popular: true,
        },
        data: {
          is_popular: false,
        },
      });
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: data.name,
        price: data.price,
        features: JSON.stringify(data.features),
        is_popular: data.isPopular || false,
        status: data.status || 'ACTIVE',
      },
    });

    logger.info('Subscription plan created', {
      planId: plan.id.toString(),
      planName: plan.name,
    });

    return {
      id: plan.id.toString(),
      name: plan.name,
      price: plan.price.toString(),
      features: JSON.parse(plan.features) as string[],
      isPopular: plan.is_popular,
      status: plan.status as 'ACTIVE' | 'INACTIVE',
      createdAt: plan.created_at.toISOString(),
      updatedAt: plan.updated_at.toISOString(),
    };
  } catch (error: any) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Error creating subscription plan', {
      error: error.message,
      data,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Update a subscription plan
 */
export const updateSubscriptionPlan = async (
  planId: string,
  data: UpdateSubscriptionPlanData
): Promise<SubscriptionPlan> => {
  try {
    // Check if plan exists
    const existingPlan = await prisma.subscriptionPlan.findUnique({
      where: {
        id: BigInt(planId),
      },
    });

    if (!existingPlan) {
      throw new NotFoundError('Subscription plan not found');
    }

    // Validate price if provided
    if (data.price !== undefined && data.price <= 0) {
      throw new ValidationError('Price must be greater than 0');
    }

    // Validate features if provided
    if (data.features !== undefined) {
      if (!Array.isArray(data.features) || data.features.length === 0) {
        throw new ValidationError('Features must be a non-empty array');
      }
    }

    // If changing name, check if new name already exists
    if (data.name && data.name !== existingPlan.name) {
      const nameExists = await prisma.subscriptionPlan.findUnique({
        where: {
          name: data.name,
        },
      });

      if (nameExists) {
        throw new ValidationError(`Subscription plan with name "${data.name}" already exists`);
      }
    }

    // If setting this as popular, unset other popular plans
    if (data.isPopular === true) {
      await prisma.subscriptionPlan.updateMany({
        where: {
          is_popular: true,
          id: { not: BigInt(planId) },
        },
        data: {
          is_popular: false,
        },
      });
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.features !== undefined) updateData.features = JSON.stringify(data.features);
    if (data.isPopular !== undefined) updateData.is_popular = data.isPopular;
    if (data.status !== undefined) updateData.status = data.status;

    const plan = await prisma.subscriptionPlan.update({
      where: {
        id: BigInt(planId),
      },
      data: updateData,
    });

    logger.info('Subscription plan updated', {
      planId: plan.id.toString(),
      planName: plan.name,
    });

    return {
      id: plan.id.toString(),
      name: plan.name,
      price: plan.price.toString(),
      features: JSON.parse(plan.features) as string[],
      isPopular: plan.is_popular,
      status: plan.status as 'ACTIVE' | 'INACTIVE',
      createdAt: plan.created_at.toISOString(),
      updatedAt: plan.updated_at.toISOString(),
    };
  } catch (error: any) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Error updating subscription plan', {
      error: error.message,
      planId,
      data,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Delete a subscription plan
 */
export const deleteSubscriptionPlan = async (planId: string): Promise<void> => {
  try {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: {
        id: BigInt(planId),
      },
    });

    if (!plan) {
      throw new NotFoundError('Subscription plan not found');
    }

    await prisma.subscriptionPlan.delete({
      where: {
        id: BigInt(planId),
      },
    });

    logger.info('Subscription plan deleted', {
      planId,
      planName: plan.name,
    });
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Error deleting subscription plan', {
      error: error.message,
      planId,
      stack: error.stack,
    });
    throw error;
  }
};
