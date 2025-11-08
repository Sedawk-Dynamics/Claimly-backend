import prisma from '../config/prismaClient';
import { NotFoundError, ConflictError } from '../utils/errors';

export interface UpdateProfileData {
  name?: string;
  dob?: string;
  email?: string;
  deviceId?: string;
}

export interface KycDocumentStatus {
  id: string;
  documentType: 'AADHAAR' | 'PAN';
  documentName: string;
  documentUrl: string;
  isVerified: boolean;
  uploadedAt: Date;
  verifiedAt?: Date | null;
}

export interface KycStatus {
  status: 'COMPLETED' | 'PENDING';
  hasAadhaar: boolean;
  hasPan: boolean;
  missingDocuments: Array<'AADHAAR' | 'PAN'>;
  documents: KycDocumentStatus[];
}

export const getUserProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: {
      id: true,
      name: true,
      dob: true,
      email: true,
      mobile_number: true,
      device_id: true,
      subscription_status: true,
      created_at: true,
      updated_at: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return {
    id: user.id.toString(),
    name: user.name,
    dob: user.dob ? user.dob.toISOString().split('T')[0] : null, // Format as YYYY-MM-DD
    email: user.email,
    mobileNumber: user.mobile_number,
    deviceId: user.device_id,
    subscriptionStatus: user.subscription_status,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
};

export const updateUserProfile = async (userId: string, data: UpdateProfileData) => {
  const updateData: any = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.dob !== undefined) updateData.dob = new Date(data.dob);
  if (data.email !== undefined) {
    // Check if email is already taken by another user
    if (data.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: data.email,
          id: { not: BigInt(userId) },
        },
      });

      if (existingUser) {
        throw new ConflictError('Email already registered to another user');
      }
    }
    updateData.email = data.email || null;
  }
  if (data.deviceId !== undefined) updateData.device_id = data.deviceId;

  const updatedUser = await prisma.user.update({
    where: { id: BigInt(userId) },
    data: updateData,
    select: {
      id: true,
      name: true,
      dob: true,
      email: true,
      mobile_number: true,
      device_id: true,
      subscription_status: true,
      created_at: true,
      updated_at: true,
    },
  });

  return {
    id: updatedUser.id.toString(),
    name: updatedUser.name,
    dob: updatedUser.dob ? updatedUser.dob.toISOString().split('T')[0] : null,
    email: updatedUser.email,
    mobileNumber: updatedUser.mobile_number,
    deviceId: updatedUser.device_id,
    subscriptionStatus: updatedUser.subscription_status,
    createdAt: updatedUser.created_at,
    updatedAt: updatedUser.updated_at,
  };
};

export const getUserSubscriptions = async (userId: string) => {
  const subscriptions = await prisma.subscription.findMany({
    where: { user_id: BigInt(userId) },
    orderBy: { transaction_date: 'desc' },
  });

  return subscriptions.map((sub) => ({
    id: sub.id.toString(),
    planName: sub.plan_name,
    amount: sub.amount.toString(),
    paymentId: sub.payment_id,
    paymentStatus: sub.payment_status,
    transactionDate: sub.transaction_date,
  }));
};

export const getCurrentSubscription = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: {
      subscription_status: true,
      subscriptions: {
        where: {
          payment_status: 'SUCCESS',
        },
        orderBy: {
          transaction_date: 'desc',
        },
        take: 1,
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const latestSubscription = user.subscriptions[0] || null;

  return {
    status: user.subscription_status,
    subscription: latestSubscription
      ? {
          id: latestSubscription.id.toString(),
          planName: latestSubscription.plan_name,
          amount: latestSubscription.amount.toString(),
          paymentId: latestSubscription.payment_id,
          transactionDate: latestSubscription.transaction_date,
        }
      : null,
  };
};

export const getUserById = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: {
      id: true,
      name: true,
      dob: true,
      email: true,
      mobile_number: true,
      device_id: true,
      subscription_status: true,
      created_at: true,
      updated_at: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return {
    id: user.id.toString(),
    name: user.name,
    dob: user.dob ? user.dob.toISOString().split('T')[0] : null,
    email: user.email,
    mobileNumber: user.mobile_number,
    deviceId: user.device_id,
    subscriptionStatus: user.subscription_status,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
};

export const updateUserById = async (userId: string, data: UpdateProfileData) => {
  const updateData: any = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.dob !== undefined) updateData.dob = new Date(data.dob);
  if (data.email !== undefined) {
    // Check if email is already taken by another user
    if (data.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: data.email,
          id: { not: BigInt(userId) },
        },
      });

      if (existingUser) {
        throw new ConflictError('Email already registered to another user');
      }
    }
    updateData.email = data.email || null;
  }
  if (data.deviceId !== undefined) updateData.device_id = data.deviceId;

  const updatedUser = await prisma.user.update({
    where: { id: BigInt(userId) },
    data: updateData,
    select: {
      id: true,
      name: true,
      dob: true,
      email: true,
      mobile_number: true,
      device_id: true,
      subscription_status: true,
      created_at: true,
      updated_at: true,
    },
  });

  return {
    id: updatedUser.id.toString(),
    name: updatedUser.name,
    dob: updatedUser.dob ? updatedUser.dob.toISOString().split('T')[0] : null,
    email: updatedUser.email,
    mobileNumber: updatedUser.mobile_number,
    deviceId: updatedUser.device_id,
    subscriptionStatus: updatedUser.subscription_status,
    createdAt: updatedUser.created_at,
    updatedAt: updatedUser.updated_at,
  };
};

export const getUserKycStatus = async (userId: string): Promise<KycStatus> => {
  const documents = await prisma.userDocument.findMany({
    where: {
      user_id: BigInt(userId),
      document_type: { in: ['AADHAAR', 'PAN'] },
    },
    orderBy: { uploaded_at: 'desc' },
  });

  const hasAadhaar = documents.some((doc) => doc.document_type === 'AADHAAR');
  const hasPan = documents.some((doc) => doc.document_type === 'PAN');

  const missingDocuments: Array<'AADHAAR' | 'PAN'> = [];
  if (!hasAadhaar) missingDocuments.push('AADHAAR');
  if (!hasPan) missingDocuments.push('PAN');

  return {
    status: hasAadhaar && hasPan ? 'COMPLETED' : 'PENDING',
    hasAadhaar,
    hasPan,
    missingDocuments,
    documents: documents.map((doc) => ({
      id: doc.id.toString(),
      documentType: doc.document_type as 'AADHAAR' | 'PAN',
      documentName: doc.document_name,
      documentUrl: doc.document_url,
      isVerified: doc.is_verified,
      uploadedAt: doc.uploaded_at,
      verifiedAt: doc.verified_at,
    })),
  };
};


