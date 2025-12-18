import prisma from '../config/prismaClient';
import { NotFoundError, ConflictError, AppError } from '../utils/errors';
import { generateReferralCode } from '../utils/referral';
import logger from '../config/logger';

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
      referral_code: true,
      referral_code_expires_at: true,
      wallet_balance: true,
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
    referralCode: user.referral_code,
    referralCodeExpiresAt: user.referral_code_expires_at ? user.referral_code_expires_at.toISOString() : null,
    walletBalance: Number(user.wallet_balance),
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
      referral_code: true,
      referral_code_expires_at: true,
      wallet_balance: true,
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
    referralCode: updatedUser.referral_code,
    referralCodeExpiresAt: updatedUser.referral_code_expires_at ? updatedUser.referral_code_expires_at.toISOString() : null,
    walletBalance: Number(updatedUser.wallet_balance),
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
    expiresAt: sub.expires_at ? sub.expires_at.toISOString() : null,
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
        select: {
          id: true,
          plan_name: true,
          amount: true,
          payment_id: true,
          payment_status: true,
          transaction_date: true,
          expires_at: true,
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

  // Calculate expires_at if it's null (for old subscriptions)
  let expiresAt: string | null = null;
  if (latestSubscription) {
    if (latestSubscription.expires_at) {
      expiresAt = latestSubscription.expires_at.toISOString();
    } else {
      // Backfill: Calculate expiry date from transaction_date (30 days)
      const calculatedExpiry = new Date(latestSubscription.transaction_date);
      calculatedExpiry.setDate(calculatedExpiry.getDate() + 30);
      expiresAt = calculatedExpiry.toISOString();

      // Optionally update the database (async, don't wait)
      prisma.subscription.update({
        where: { id: latestSubscription.id },
        data: { expires_at: calculatedExpiry },
      }).catch(err => {
        console.error('Failed to update subscription expiry:', err);
      });
    }
  }

  return {
    status: user.subscription_status,
    subscription: latestSubscription
      ? {
          id: latestSubscription.id.toString(),
          planName: latestSubscription.plan_name,
          amount: latestSubscription.amount.toString(),
          paymentId: latestSubscription.payment_id,
          transactionDate: latestSubscription.transaction_date,
          expiresAt: expiresAt,
          paymentStatus: latestSubscription.payment_status,
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
      referral_code: true,
      referral_code_expires_at: true,
      wallet_balance: true,
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
    referralCode: user.referral_code,
    referralCodeExpiresAt: user.referral_code_expires_at ? user.referral_code_expires_at.toISOString() : null,
    walletBalance: Number(user.wallet_balance),
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
      referral_code: true,
      referral_code_expires_at: true,
      wallet_balance: true,
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
    referralCode: updatedUser.referral_code,
    referralCodeExpiresAt: updatedUser.referral_code_expires_at ? updatedUser.referral_code_expires_at.toISOString() : null,
    walletBalance: Number(updatedUser.wallet_balance),
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
      rejectedAt: doc.rejected_at,
    })),
  };
};

export const generateUserReferralCode = async (userId: string, regenerate: boolean = false): Promise<{ referralCode: string; expiresAt: Date }> => {
  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: { id: true, referral_code: true, referral_code_expires_at: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // If user already has a valid (non-expired) referral code and not regenerating, return it
  if (!regenerate && user.referral_code && user.referral_code_expires_at) {
    const now = new Date();
    const expiresAt = new Date(user.referral_code_expires_at);
    
    // If code is still valid, return existing code
    if (expiresAt > now) {
      return {
        referralCode: user.referral_code,
        expiresAt: expiresAt,
      };
    }
    // If expired, allow regeneration (fall through)
  }

  // Generate unique referral code
  let referralCode: string | undefined;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    referralCode = generateReferralCode();
    const existingCode = await prisma.user.findUnique({
      where: { referral_code: referralCode },
    });

    if (!existingCode) {
      isUnique = true;
    } else {
      attempts++;
    }
  }

  if (!isUnique || !referralCode) {
    throw new AppError('Failed to generate unique referral code', 500);
  }

  // Set expiration to 30 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  // Update user with referral code and expiration
  await prisma.user.update({
    where: { id: BigInt(userId) },
    data: { 
      referral_code: referralCode,
      referral_code_expires_at: expiresAt,
    },
  });

  logger.info('Referral code generated for user', { userId, referralCode, expiresAt });

  return {
    referralCode,
    expiresAt,
  };
};

/**
 * Register FCM token for push notifications
 */
export const registerFCMToken = async (userId: string, token: string): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Store FCM token in device_id field
  await prisma.user.update({
    where: { id: BigInt(userId) },
    data: { device_id: token },
  });

  logger.info('FCM token registered for user', { userId });
};

/**
 * Unregister FCM token (remove it)
 */
export const unregisterFCMToken = async (userId: string): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Clear FCM token
  await prisma.user.update({
    where: { id: BigInt(userId) },
    data: { device_id: null },
  });

  logger.info('FCM token unregistered for user', { userId });
};

/**
 * Get FCM token for a user
 */
export const getFCMToken = async (userId: string): Promise<string | null> => {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: { device_id: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return user.device_id;
};


