import prisma from '../config/prismaClient';
import { NotFoundError, ConflictError, AppError } from '../utils/errors';
import { generateReferralCode } from '../utils/referral';
import logger from '../config/logger';
import { getProfilePictureUrl, deleteFile } from '../utils/fileUpload';

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
  kycStatus?: 'REJECTED' | 'ACCEPTED' | 'PENDING' | 'DRAFT';
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
      wallet_balance: true,
      profile_picture: true,
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
    walletBalance: Number(user.wallet_balance),
    profilePicture: user.profile_picture || null,
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
      wallet_balance: true,
      profile_picture: true,
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
    walletBalance: Number(updatedUser.wallet_balance),
    profilePicture: updatedUser.profile_picture || null,
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
    neverExpires: !sub.expires_at,
    receiptUrl: sub.receipt_url || null,
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
          receipt_url: true,
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

  // expires_at: null = lifetime (never expires)
  let expiresAt: string | null = null;
  if (latestSubscription?.expires_at) {
    expiresAt = latestSubscription.expires_at.toISOString();
  }
  const neverExpires = !latestSubscription?.expires_at;

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
          neverExpires,
          paymentStatus: latestSubscription.payment_status,
          receiptUrl: latestSubscription.receipt_url || null,
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
      wallet_balance: true,
      profile_picture: true,
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
    walletBalance: Number(user.wallet_balance),
    profilePicture: user.profile_picture || null,
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
      wallet_balance: true,
      profile_picture: true,
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
    walletBalance: Number(updatedUser.wallet_balance),
    profilePicture: updatedUser.profile_picture || null,
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
  const hasVerifiedAadhaar = documents.some(
    (doc) => doc.document_type === 'AADHAAR' && doc.is_verified
  );
  const hasVerifiedPan = documents.some(
    (doc) => doc.document_type === 'PAN' && doc.is_verified
  );

  const missingDocuments: Array<'AADHAAR' | 'PAN'> = [];
  if (!hasAadhaar) missingDocuments.push('AADHAAR');
  if (!hasPan) missingDocuments.push('PAN');

  // Calculate KYC status using the same logic as admin
  const documentTypes: Array<'AADHAAR' | 'PAN'> = ['AADHAAR', 'PAN'];
  const kycDocuments = documents.filter((doc) => 
    documentTypes.includes(doc.document_type as 'AADHAAR' | 'PAN')
  );
  
  // Check which document types are present
  const hasAadhaarDoc = kycDocuments.some((doc) => doc.document_type === 'AADHAAR');
  const hasPanDoc = kycDocuments.some((doc) => doc.document_type === 'PAN');
  
  // DRAFT: Only 1 document uploaded and 1 not uploaded, or no documents at all
  let kycStatus: 'REJECTED' | 'ACCEPTED' | 'PENDING' | 'DRAFT' = 'DRAFT';
  
  if (hasAadhaarDoc && hasPanDoc) {
    // Get verified and rejected counts
    const verifiedDocs = kycDocuments.filter((doc) => doc.is_verified);
    const rejectedDocs = kycDocuments.filter((doc) => doc.rejected_at !== null);
    const totalDocs = kycDocuments.length;
    
    // REJECTED: All documents are rejected
    if (rejectedDocs.length === totalDocs && totalDocs > 0) {
      kycStatus = 'REJECTED';
    }
    // ACCEPTED: All documents are verified
    else if (verifiedDocs.length === totalDocs && totalDocs > 0) {
      kycStatus = 'ACCEPTED';
    }
    // PENDING: Any other case (includes 1 accepted and 1 rejected, or partially verified)
    else {
      kycStatus = 'PENDING';
    }
  }

  // Map status to COMPLETED/PENDING for backward compatibility
  const status = kycStatus === 'ACCEPTED' ? 'COMPLETED' : 'PENDING';

  return {
    status,
    kycStatus,
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

export const generateUserReferralCode = async (userId: string): Promise<{ referralCode: string }> => {
  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: { id: true, referral_code: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // If user already has a referral code, return it (permanent code, cannot be changed)
  if (user.referral_code) {
    return {
      referralCode: user.referral_code,
    };
  }

  // Generate unique referral code only if user doesn't have one
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

  // Update user with referral code (permanent, no expiration, cannot be changed)
  await prisma.user.update({
    where: { id: BigInt(userId) },
    data: { 
      referral_code: referralCode,
    },
  });

  logger.info('Referral code generated for user', { userId, referralCode });

  return {
    referralCode,
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

export const uploadProfilePicture = async (userId: string, filename: string) => {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: { profile_picture: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Delete old profile picture if exists
  if (user.profile_picture) {
    const oldFilename = user.profile_picture.split('/').pop();
    if (oldFilename) {
      try {
        deleteFile(oldFilename, 'users/profile-pic');
      } catch (error) {
        logger.warn('Failed to delete old profile picture', { userId, filename: oldFilename, error });
      }
    }
  }

  // Generate file URL
  const profilePictureUrl = getProfilePictureUrl(filename);

  // Update user with new profile picture
  const updatedUser = await prisma.user.update({
    where: { id: BigInt(userId) },
    data: { profile_picture: profilePictureUrl },
    select: {
      id: true,
      name: true,
      dob: true,
      email: true,
      mobile_number: true,
      device_id: true,
      subscription_status: true,
      referral_code: true,
      wallet_balance: true,
      profile_picture: true,
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
    walletBalance: Number(updatedUser.wallet_balance),
    profilePicture: updatedUser.profile_picture || null,
    createdAt: updatedUser.created_at,
    updatedAt: updatedUser.updated_at,
  };
};


