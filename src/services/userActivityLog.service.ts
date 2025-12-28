import prisma from '../config/prismaClient';
import { NotFoundError } from '../utils/errors';

export type ActivityType =
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_UPDATED'
  | 'SUBSCRIPTION_CREATED'
  | 'SUBSCRIPTION_EXPIRED'
  | 'NOMINEE_ADDED'
  | 'NOMINEE_UPDATED'
  | 'POLICY_ADDED'
  | 'POLICY_DOCUMENT_UPLOADED'
  | 'NOMINEE_DOCUMENT_UPLOADED'
  | 'NOMINEE_DRAFT_SAVED'
  | 'POLICY_DRAFT_SAVED';

export interface CreateActivityLogData {
  userId: string;
  activityType: ActivityType;
  description?: string;
  metadata?: Record<string, any>;
}

export const createActivityLog = async (data: CreateActivityLogData) => {
  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: BigInt(data.userId) },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const activityLog = await prisma.userActivityLog.create({
    data: {
      user_id: BigInt(data.userId),
      activity_type: data.activityType,
      description: data.description || null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
    },
  });

  return {
    id: activityLog.id.toString(),
    userId: activityLog.user_id.toString(),
    activityType: activityLog.activity_type,
    description: activityLog.description,
    metadata: activityLog.metadata ? JSON.parse(activityLog.metadata) : null,
    createdAt: activityLog.created_at,
  };
};

export const getUserActivityLogs = async (
  userId: string,
  page: number = 1,
  limit: number = 50
) => {
  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.userActivityLog.findMany({
      where: { user_id: BigInt(userId) },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.userActivityLog.count({
      where: { user_id: BigInt(userId) },
    }),
  ]);

  return {
    logs: logs.map((log: any) => ({
      id: log.id.toString(),
      userId: log.user_id.toString(),
      activityType: log.activity_type,
      description: log.description,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
      createdAt: log.created_at,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const deleteActivityLog = async (logId: string) => {
  const activityLog = await prisma.userActivityLog.findUnique({
    where: { id: BigInt(logId) },
  });

  if (!activityLog) {
    throw new NotFoundError('Activity log not found');
  }

  await prisma.userActivityLog.delete({
    where: { id: BigInt(logId) },
  });

  return {
    message: 'Activity log deleted successfully',
    logId,
  };
};

export const deleteAllActivityLogs = async (userId: string) => {
  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const result = await prisma.userActivityLog.deleteMany({
    where: { user_id: BigInt(userId) },
  });

  return {
    message: 'All activity logs deleted successfully',
    deletedCount: result.count,
    userId,
  };
};

