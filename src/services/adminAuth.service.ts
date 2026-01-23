import bcrypt from 'bcrypt';
import prisma from '../config/prismaClient';
import { generateAdminToken } from '../utils/adminJwt';
import { UnauthorizedError, ValidationError, ConflictError, AppError } from '../utils/errors';
import logger from '../config/logger';
import admin from '../config/firebase';
import { generateReferralCode } from '../utils/referral';

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  token: string;
  admin: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export const adminLogin = async (data: AdminLoginRequest): Promise<AdminLoginResponse> => {
  // Normalize email to lowercase for case-insensitive matching
  const normalizedEmail = data.email.toLowerCase().trim();
  
  logger.info('Admin login attempt', { email: normalizedEmail });
  
  // Find admin by email (case-insensitive)
  const admin = await prisma.admin.findUnique({
    where: { email: normalizedEmail },
  });

  if (!admin) {
    logger.warn('Admin login failed: user not found', { email: data.email });
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!admin.password_hash) {
    logger.error('Admin login failed: password hash missing', { email: data.email, adminId: admin.id.toString() });
    throw new UnauthorizedError('Invalid email or password');
  }

  let isPasswordValid = false;
  try {
    isPasswordValid = await bcrypt.compare(data.password, admin.password_hash);
  } catch (error) {
    logger.error('Admin login failed: password verification error', {
      email: data.email,
      adminId: admin.id.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!isPasswordValid) {
    logger.warn('Admin login failed: invalid password', { email: data.email, adminId: admin.id.toString() });
    throw new UnauthorizedError('Invalid email or password');
  }

  logger.info('Admin authenticated successfully', { adminId: admin.id.toString(), email: admin.email });

  // Generate JWT token
  const token = generateAdminToken({
    adminId: admin.id.toString(),
    email: admin.email,
    role: admin.role,
  });

  return {
    token,
    admin: {
      id: admin.id.toString(),
      name: admin.name,
      email: admin.email,
      role: admin.role,
    },
  };
};

// Helper function to normalize phone numbers
function normalizePhoneNumber(phoneNumber: string): string {
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  if (digitsOnly.length >= 10) {
    return digitsOnly.slice(-10);
  }
  return digitsOnly;
}

export interface AgentSignupRequest {
  idToken: string; // Firebase ID token from OTP verification
  name: string;
  email: string;
  mobileNumber: string;
  password: string;
}

export interface AgentLoginRequest {
  /**
   * Optional Firebase ID token from OTP verification.
   * If provided, we validate it. If omitted, we allow plain email/password
   * login for existing agents.
   */
  idToken?: string;
  email: string;
  password: string;
}

export interface AgentSignupResponse {
  token: string;
  agent: {
    id: string;
    name: string;
    email: string;
    mobileNumber: string;
    role: string;
    isVerified: boolean;
  };
}

export const agentSignup = async (data: AgentSignupRequest): Promise<AgentSignupResponse> => {
  try {
    // Validate required fields
    if (!data.idToken) {
      throw new ValidationError('Firebase ID token is required');
    }
    if (!data.name || !data.email || !data.mobileNumber || !data.password) {
      throw new ValidationError('Name, email, mobile number, and password are required');
    }

    // Normalize phone number
    const normalizedMobileNumber = normalizePhoneNumber(data.mobileNumber);
    if (normalizedMobileNumber.length !== 10 || !/^\d{10}$/.test(normalizedMobileNumber)) {
      throw new ValidationError('Invalid mobile number format. Must be 10 digits.');
    }

    // Normalize email
    const normalizedEmail = data.email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new ValidationError('Invalid email format');
    }

    logger.info('Agent signup attempt', { email: normalizedEmail, mobileNumber: normalizedMobileNumber });

    // Verify Firebase ID token
    let decodedToken;
    try {
      if (!admin.apps.length) {
        logger.error('Firebase Admin not initialized');
        throw new AppError('Firebase Admin SDK not initialized. Please check server configuration.', 500);
      }
      decodedToken = await admin.auth().verifyIdToken(data.idToken);
    } catch (firebaseError: any) {
      logger.error('Firebase token verification failed', {
        error: firebaseError?.message || 'Unknown Firebase error',
        code: firebaseError?.code,
      });
      throw new ValidationError('Invalid or expired Firebase token');
    }

    // Check if agent already exists by email or mobile number
    const existingAgent = await prisma.admin.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { mobile_number: normalizedMobileNumber },
        ],
      },
    });

    if (existingAgent) {
      if (existingAgent.email === normalizedEmail) {
        throw new ConflictError('An agent with this email already exists');
      }
      if (existingAgent.mobile_number === normalizedMobileNumber) {
        throw new ConflictError('An agent with this mobile number already exists');
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create agent (not verified yet)
    const agent = await prisma.admin.create({
      data: {
        name: data.name,
        email: normalizedEmail,
        mobile_number: normalizedMobileNumber,
        password_hash: passwordHash,
        role: 'AGENT',
        is_verified: false,
      },
    });

    logger.info('Agent created successfully', { agentId: agent.id.toString(), email: agent.email });

    // Generate JWT token (agent can login but won't have access until verified)
    const token = generateAdminToken({
      adminId: agent.id.toString(),
      email: agent.email,
      role: agent.role,
    });

    return {
      token,
      agent: {
        id: agent.id.toString(),
        name: agent.name,
        email: agent.email,
        mobileNumber: agent.mobile_number || '',
        role: agent.role,
        isVerified: agent.is_verified,
      },
    };
  } catch (error) {
    logger.error('Agent signup failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      email: data.email,
    });

    if (error instanceof AppError) {
      throw error;
    }

    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as any;
      if (prismaError.code === 'P2002') {
        throw new ConflictError('An agent with this information already exists');
      }
    }

    if (error instanceof Error) {
      throw new AppError(`Agent signup failed: ${error.message}`, 500);
    }

    throw new AppError('Agent signup failed: Unknown error', 500);
  }
};

export const agentLogin = async (data: AgentLoginRequest): Promise<AdminLoginResponse> => {
  try {
    // Validate required fields
    if (!data.email || !data.password) {
      throw new ValidationError('Email and password are required');
    }

    // Normalize email
    const normalizedEmail = data.email.toLowerCase().trim();

    logger.info('Agent login attempt', { email: normalizedEmail });

    // If an idToken is provided, validate it using Firebase Admin.
    // This enables optional OTP-backed login for additional security,
    // but does not force OTP for every agent login.
    if (data.idToken) {
      try {
        if (!admin.apps.length) {
          logger.error('Firebase Admin not initialized');
          throw new AppError('Firebase Admin SDK not initialized. Please check server configuration.', 500);
        }
        await admin.auth().verifyIdToken(data.idToken);
      } catch (firebaseError: any) {
        logger.error('Firebase token verification failed', {
          error: firebaseError?.message || 'Unknown Firebase error',
          code: firebaseError?.code,
        });
        throw new ValidationError('Invalid or expired Firebase token');
      }
    }

    // Find agent by email
    const agent = await prisma.admin.findUnique({
      where: { email: normalizedEmail },
    });

    if (!agent) {
      logger.warn('Agent login failed: agent not found', { email: normalizedEmail });
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if it's an agent
    if (agent.role !== 'AGENT') {
      logger.warn('Agent login failed: not an agent', { email: normalizedEmail, role: agent.role });
      throw new UnauthorizedError('Invalid email or password');
    }

    // Verify password
    if (!agent.password_hash) {
      logger.error('Agent login failed: password hash missing', { email: normalizedEmail, agentId: agent.id.toString() });
      throw new UnauthorizedError('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(data.password, agent.password_hash);
    if (!isPasswordValid) {
      logger.warn('Agent login failed: invalid password', { email: normalizedEmail, agentId: agent.id.toString() });
      throw new UnauthorizedError('Invalid email or password');
    }

    logger.info('Agent authenticated successfully', { agentId: agent.id.toString(), email: agent.email, isVerified: agent.is_verified });

    // Generate JWT token
    const token = generateAdminToken({
      adminId: agent.id.toString(),
      email: agent.email,
      role: agent.role,
    });

    return {
      token,
      admin: {
        id: agent.id.toString(),
        name: agent.name,
        email: agent.email,
        role: agent.role,
      },
    };
  } catch (error) {
    logger.error('Agent login failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      email: data.email,
    });

    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new AppError(`Agent login failed: ${error.message}`, 500);
    }

    throw new AppError('Agent login failed: Unknown error', 500);
  }
};

export interface VerifyAgentRequest {
  agentId: string;
}

export interface AgentListResponse {
  agents: Array<{
    id: string;
    name: string;
    email: string;
    mobileNumber: string | null;
    role: string;
    isVerified: boolean;
    verifiedBy: string | null;
    verifiedAt: Date | null;
    createdAt: Date;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const getOrCreateAgentReferralCode = async (adminId: string): Promise<{ referralCode: string }> => {
  const id = BigInt(adminId);

  const agent = await prisma.admin.findUnique({
    where: { id },
    select: { id: true, role: true, referral_code: true },
  });

  if (!agent) {
    throw new ValidationError('Agent not found');
  }

  if (agent.role !== 'AGENT') {
    throw new ValidationError('Only agents can have agent referral codes');
  }

  // If agent already has a referral code, return it
  if (agent.referral_code) {
    return { referralCode: agent.referral_code };
  }

  // Generate unique referral code for agent (similar to user referral codes)
  let referralCode: string | undefined;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    referralCode = generateReferralCode();
    const existing = await prisma.admin.findFirst({
      where: { referral_code: referralCode },
      select: { id: true },
    });

    if (!existing) {
      isUnique = true;
    } else {
      attempts++;
    }
  }

  if (!isUnique || !referralCode) {
    throw new AppError('Failed to generate unique agent referral code', 500);
  }

  const updated = await prisma.admin.update({
    where: { id },
    data: { referral_code: referralCode },
    select: { referral_code: true },
  });

  logger.info('Agent referral code generated', { agentId: adminId, referralCode: updated.referral_code });

  return { referralCode: updated.referral_code! };
};

export const getAgentReferrals = async (
  adminId: string
): Promise<{
  referrals: Array<{
    id: string;
    name: string;
    email: string | null;
    mobileNumber: string;
    createdAt: Date;
    hasSubscription: boolean;
    firstSubscriptionAt: Date | null;
    commissionAmount: number;
  }>;
  stats: {
    totalReferredUsers: number;
    totalSubscribedUsers: number;
    totalCommissionAmount: number;
  };
  transactions: Array<{
    id: string;
    userId: string;
    userName: string;
    planName: string;
    amount: number;
    commissionAmount: number;
    transactionDate: Date;
  }>;
}> => {
  const id = BigInt(adminId);

  const agent = await prisma.admin.findUnique({
    where: { id },
    select: { id: true, role: true },
  });

  if (!agent) {
    throw new ValidationError('Agent not found');
  }

  if (agent.role !== 'AGENT') {
    throw new ValidationError('Only agents can view agent referrals');
  }

  const users = await prisma.user.findMany({
    where: { referred_by_agent: id },
    select: {
      id: true,
      name: true,
      email: true,
      mobile_number: true,
      created_at: true,
      subscriptions: {
        where: { payment_status: 'SUCCESS' },
        orderBy: { transaction_date: 'asc' },
        select: {
          id: true,
          plan_name: true,
          amount: true,
          transaction_date: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  const rewardPercentage = 0.10; // 10% commission on first successful subscription

  const referrals = users.map((u) => {
    const hasSubscription = u.subscriptions.length > 0;
    const firstSubscription = hasSubscription ? u.subscriptions[0] : null;
    const commissionAmount = firstSubscription ? Number(firstSubscription.amount) * rewardPercentage : 0;

    return {
      id: u.id.toString(),
      name: u.name,
      email: u.email,
      mobileNumber: u.mobile_number,
      createdAt: u.created_at,
      hasSubscription,
      firstSubscriptionAt: firstSubscription ? firstSubscription.transaction_date : null,
      commissionAmount,
    };
  });

  const totalReferredUsers = referrals.length;
  const totalSubscribedUsers = referrals.filter((r) => r.hasSubscription).length;
  const totalCommissionAmount = referrals.reduce((sum, r) => sum + r.commissionAmount, 0);

  const transactions = users
    .map((u) => {
      const firstSubscription = u.subscriptions[0];
      if (!firstSubscription) return null;
      const commissionAmount = Number(firstSubscription.amount) * rewardPercentage;
      return {
        id: firstSubscription.id.toString(),
        userId: u.id.toString(),
        userName: u.name,
        planName: firstSubscription.plan_name,
        amount: Number(firstSubscription.amount),
        commissionAmount,
        transactionDate: firstSubscription.transaction_date,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  return {
    referrals,
    stats: {
      totalReferredUsers,
      totalSubscribedUsers,
      totalCommissionAmount,
    },
    transactions,
  };
};

export const getAllAgents = async (page: number = 1, limit: number = 20, search?: string): Promise<AgentListResponse> => {
  const skip = (page - 1) * limit;
  const where: any = {
    role: 'AGENT',
  };

  if (search && search.trim()) {
    const searchTerm = search.trim();
    where.OR = [
      { name: { contains: searchTerm, mode: 'insensitive' } },
      { email: { contains: searchTerm, mode: 'insensitive' } },
      { mobile_number: { contains: searchTerm } },
    ];
  }

  const [agents, total] = await Promise.all([
    prisma.admin.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        verified_by_admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.admin.count({ where }),
  ]);

  return {
    agents: agents.map((agent) => ({
      id: agent.id.toString(),
      name: agent.name,
      email: agent.email,
      mobileNumber: agent.mobile_number,
      role: agent.role,
      isVerified: agent.is_verified,
      verifiedBy: agent.verified_by_admin?.id.toString() || null,
      verifiedAt: agent.verified_at,
      createdAt: agent.created_at,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const verifyAgent = async (agentId: string, adminId: string): Promise<{ id: string; isVerified: boolean; verifiedAt: Date | null }> => {
  const agent = await prisma.admin.findUnique({
    where: { id: BigInt(agentId) },
  });

  if (!agent) {
    throw new ValidationError('Agent not found');
  }

  if (agent.role !== 'AGENT') {
    throw new ValidationError('User is not an agent');
  }

  if (agent.is_verified) {
    throw new ConflictError('Agent is already verified');
  }

  const verifiedAgent = await prisma.admin.update({
    where: { id: BigInt(agentId) },
    data: {
      is_verified: true,
      verified_by: BigInt(adminId),
      verified_at: new Date(),
    },
  });

  logger.info('Agent verified', { agentId, adminId });

  return {
    id: verifiedAgent.id.toString(),
    isVerified: verifiedAgent.is_verified,
    verifiedAt: verifiedAgent.verified_at,
  };
};

export const revokeAgentVerification = async (agentId: string, adminId: string): Promise<{ id: string; isVerified: boolean; verifiedAt: Date | null }> => {
  const agent = await prisma.admin.findUnique({
    where: { id: BigInt(agentId) },
  });

  if (!agent) {
    throw new ValidationError('Agent not found');
  }

  if (agent.role !== 'AGENT') {
    throw new ValidationError('User is not an agent');
  }

  if (!agent.is_verified) {
    throw new ConflictError('Agent is not verified');
  }

  const revokedAgent = await prisma.admin.update({
    where: { id: BigInt(agentId) },
    data: {
      is_verified: false,
      verified_by: null,
      verified_at: null,
    },
  });

  logger.info('Agent verification revoked', { agentId, adminId });

  return {
    id: revokedAgent.id.toString(),
    isVerified: revokedAgent.is_verified,
    verifiedAt: revokedAgent.verified_at,
  };
};

export const rejectAgent = async (agentId: string, adminId: string): Promise<void> => {
  const agent = await prisma.admin.findUnique({
    where: { id: BigInt(agentId) },
  });

  if (!agent) {
    throw new ValidationError('Agent not found');
  }

  if (agent.role !== 'AGENT') {
    throw new ValidationError('User is not an agent');
  }

  // For now, "reject" for agents means deleting an unverified agent record
  if (agent.is_verified) {
    throw new ConflictError('Cannot reject an already verified agent');
  }

  await prisma.admin.delete({
    where: { id: BigInt(agentId) },
  });

  logger.info('Agent rejected (deleted)', { agentId, adminId });
};

export const deleteAgent = async (agentId: string, adminId: string): Promise<void> => {
  const agent = await prisma.admin.findUnique({
    where: { id: BigInt(agentId) },
  });

  if (!agent) {
    throw new ValidationError('Agent not found');
  }

  if (agent.role !== 'AGENT') {
    throw new ValidationError('User is not an agent');
  }

  await prisma.admin.delete({
    where: { id: BigInt(agentId) },
  });

  logger.info('Agent deleted by admin', { agentId, adminId });
};

