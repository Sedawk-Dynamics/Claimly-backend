import prisma from '../config/prismaClient';
import { NotFoundError } from '../utils/errors';

export interface CreateAdminActionData {
  userId: string;
  actionType: string;
  notes?: string;
}

export const createAdminAction = async (adminId: string, data: CreateAdminActionData) => {
  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: BigInt(data.userId) },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const action = await prisma.adminAction.create({
    data: {
      admin_id: BigInt(adminId),
      user_id: BigInt(data.userId),
      action_type: data.actionType,
      notes: data.notes || null,
    },
    include: {
      admin: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          mobile_number: true,
        },
      },
    },
  });

  return {
    id: action.id.toString(),
    admin: {
      id: action.admin.id.toString(),
      name: action.admin.name,
      email: action.admin.email,
      role: action.admin.role,
    },
    user: {
      id: action.user.id.toString(),
      name: action.user.name,
      email: action.user.email,
      mobileNumber: action.user.mobile_number,
    },
    actionType: action.action_type,
    notes: action.notes,
    createdAt: action.created_at,
  };
};

export const getAllAdminActions = async (
  page: number = 1,
  limit: number = 20,
  adminId?: string,
  userId?: string,
  actionType?: string
) => {
  const skip = (page - 1) * limit;
  const where: any = {};

  if (adminId) {
    where.admin_id = BigInt(adminId);
  }

  if (userId) {
    where.user_id = BigInt(userId);
  }

  if (actionType) {
    where.action_type = { contains: actionType };
  }

  const [actions, total] = await Promise.all([
    prisma.adminAction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.adminAction.count({ where }),
  ]);

  return {
    actions: actions.map((action) => ({
      id: action.id.toString(),
      admin: {
        id: action.admin.id.toString(),
        name: action.admin.name,
        email: action.admin.email,
        role: action.admin.role,
      },
      user: {
        id: action.user.id.toString(),
        name: action.user.name,
        email: action.user.email,
      },
      actionType: action.action_type,
      notes: action.notes,
      createdAt: action.created_at,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getAdminActionById = async (actionId: string) => {
  const action = await prisma.adminAction.findUnique({
    where: { id: BigInt(actionId) },
    include: {
      admin: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      user: {
        include: {
          policies: {
            select: {
              id: true,
              policy_number: true,
            },
          },
        },
      },
    },
  });

  if (!action) {
    throw new NotFoundError('Action not found');
  }

  return {
    id: action.id.toString(),
    admin: {
      id: action.admin.id.toString(),
      name: action.admin.name,
      email: action.admin.email,
      role: action.admin.role,
    },
    user: {
      id: action.user.id.toString(),
      name: action.user.name,
      email: action.user.email,
      mobileNumber: action.user.mobile_number,
      policiesCount: action.user.policies.length,
    },
    actionType: action.action_type,
    notes: action.notes,
    createdAt: action.created_at,
  };
};

