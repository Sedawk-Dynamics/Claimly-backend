import admin from '../config/firebase';
import prisma from '../config/prismaClient';
import { generateToken } from '../utils/jwt';
import { ValidationError, ConflictError, AppError } from '../utils/errors';
import logger from '../config/logger';
import { generateReferralCode, isValidReferralCodeFormat } from '../utils/referral';

export interface VerifyOTPRequest {
  idToken: string; // Firebase ID token from client
  mobileNumber: string;
  name?: string;
  email?: string;
  deviceId?: string;
  referralCode?: string;
  dob?: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string | null;
    mobileNumber: string;
    subscriptionStatus: string;
    dob?: string | null;
  };
}

/**
 * Normalizes a phone number to exactly 10 digits
 * Removes all non-digit characters and takes the last 10 digits
 */
function normalizePhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  const digitsOnly = phoneNumber.replace(/\D/g, '');

  // Take the last 10 digits (handles country codes like +91)
  if (digitsOnly.length >= 10) {
    return digitsOnly.slice(-10);
  }

  // If less than 10 digits, return as is (will be caught by validation)
  return digitsOnly;
}

export const verifyOTP = async (data: VerifyOTPRequest): Promise<AuthResponse> => {
  try {
    // Validate required fields
    if (!data.idToken) {
      throw new ValidationError('Firebase ID token is required');
    }

    if (!data.mobileNumber) {
      throw new ValidationError('Mobile number is required');
    }

    // Normalize phone number to ensure consistent format
    const normalizedMobileNumber = normalizePhoneNumber(data.mobileNumber);

    // Validate phone number format (should be exactly 10 digits after normalization)
    if (normalizedMobileNumber.length !== 10 || !/^\d{10}$/.test(normalizedMobileNumber)) {
      throw new ValidationError('Invalid mobile number format. Must be 10 digits.');
    }

    logger.info('OTP verification attempt', { mobileNumber: normalizedMobileNumber });

    // Verify the Firebase ID token
    let decodedToken;
    try {
      // Check if Firebase Admin is initialized
      if (!admin.apps.length) {
        logger.error('Firebase Admin not initialized');
        throw new AppError('Firebase Admin SDK not initialized. Please check server configuration.', 500);
      }
      decodedToken = await admin.auth().verifyIdToken(data.idToken);
    } catch (firebaseError: any) {
      logger.error('Firebase token verification failed', {
        error: firebaseError?.message || 'Unknown Firebase error',
        code: firebaseError?.code,
        stack: firebaseError?.stack,
      });
      // If it's an initialization error, return 500, otherwise 400
      if (firebaseError?.message?.includes('not initialized') || firebaseError?.code === 'app/no-app') {
        throw new AppError('Authentication service unavailable. Please contact support.', 500);
      }
      throw new ValidationError('Invalid or expired Firebase token');
    }

    const firebaseUid = decodedToken.uid;
    logger.debug('Firebase token verified', { firebaseUid });

    // Check if user exists in database by firebase_id
    let user = await prisma.user.findUnique({
      where: { firebase_id: firebaseUid },
    });

    // If user doesn't exist by firebase_id, check by mobile number
    if (!user) {
      // Check if mobile number already exists
      const existingUser = await prisma.user.findUnique({
        where: { mobile_number: normalizedMobileNumber },
      });

      // If user exists by mobile number, link the firebase_id to existing user
      if (existingUser) {
        // Update user details if provided (handling potential undefined values)
        const updateData: any = {
          firebase_id: firebaseUid,
          device_id: data.deviceId || existingUser.device_id,
        };

        // If name is provided and different (or missing in DB), update it
        if (data.name) {
          updateData.name = data.name;
        }

        // If email is provided, check uniqueness and update
        if (data.email && data.email !== existingUser.email) {
          // Check if email is already taken by another user
          const emailExists = await prisma.user.findFirst({
            where: {
              email: data.email,
              id: { not: existingUser.id }
            },
          });

          if (!emailExists) {
            updateData.email = data.email;
          }
        }

        // If DOB is provided, update it
        if (data.dob) {
          const parsed = new Date(data.dob);
          if (!isNaN(parsed.getTime())) {
            updateData.dob = parsed;
          } else {
            throw new ValidationError('Invalid DOB format. Use YYYY-MM-DD');
          }
        } else if (!existingUser.dob) {
          throw new ValidationError('Date of Birth is required to complete registration');
        }

        // Force DOB requirement if it's missing in DB and also missing in request?
        // Let's at least make sure we don't silently ignore invalid DOBs as before.

        logger.info('Updating existing mobile user', {
          foundUserId: existingUser.id.toString(),
          hasDobInRequest: !!data.dob,
          updateDataKeys: Object.keys(updateData)
        });

        user = await prisma.user.update({
          where: { id: existingUser.id },
          data: updateData,
        });

        logger.info('Linked Firebase ID to existing user and updated details', {
          userId: user.id.toString(),
          mobileNumber: normalizedMobileNumber,
          userDobAfterUpdate: user.dob
        });
      } else {
        // User doesn't exist at all - require name, email AND dob for new user
        if (!data.name || !data.email || !data.dob) {
          throw new ValidationError('Name, email and DOB are required for new users');
        }

        // Check if email already exists
        const existingEmailUser = await prisma.user.findFirst({
          where: { email: data.email },
        });

        if (existingEmailUser) {
          throw new ConflictError('Email already registered');
        }

        // Validate and find referrer if referral code is provided
        let referredById: bigint | null = null;           // normal user referrer
        let referredByAgentId: bigint | null = null;      // agent referrer (Admin with role AGENT)
        let referralCode: string | undefined;

        // Check if referral_code column exists by trying a simple query
        let referralCodeColumnExists = false;
        try {
          // Try to query referral_code to see if column exists
          await prisma.$queryRaw`SELECT referral_code FROM "User" LIMIT 1`;
          referralCodeColumnExists = true;
        } catch (error: any) {
          // Column doesn't exist, skip referral code logic
          if (error?.message?.includes('referral_code') || error?.message?.includes('does not exist')) {
            logger.warn('referral_code column does not exist, skipping referral code logic');
            referralCodeColumnExists = false;
          } else {
            // Some other error, re-throw
            throw error;
          }
        }

        if (referralCodeColumnExists && data.referralCode) {
          if (!isValidReferralCodeFormat(data.referralCode)) {
            throw new ValidationError('Invalid referral code');
          }

          try {
            const normalizedCode = data.referralCode.toUpperCase();

            // First try to resolve as a normal user referral code
            const userReferrer = await prisma.user.findUnique({
              where: { referral_code: normalizedCode },
              select: { id: true },
            });

            if (userReferrer) {
              referredById = userReferrer.id;
              logger.info('User referral code validated', {
                referralCode: normalizedCode,
                referrerId: userReferrer.id.toString(),
              });
            } else {
              // If no user found, try to resolve as an AGENT referral code on Admin
              const agentReferrer = await prisma.admin.findFirst({
                where: { referral_code: normalizedCode, role: 'AGENT' },
                select: { id: true },
              });

              if (!agentReferrer) {
                throw new ValidationError('Invalid referral code');
              }

              referredByAgentId = agentReferrer.id;
              logger.info('Agent referral code validated', {
                referralCode: normalizedCode,
                agentId: agentReferrer.id.toString(),
              });
            }
          } catch (error: any) {
            // If error is about missing column, skip referral validation
            if (error?.message?.includes('referral_code') && error?.message?.includes('does not exist')) {
              logger.warn('referral_code column does not exist, skipping referral validation');
            } else {
              throw error;
            }
          }
        }

        // Generate unique referral code for new user (only if column exists)
        if (referralCodeColumnExists) {
          let isUnique = false;
          let attempts = 0;
          const maxAttempts = 10;

          while (!isUnique && attempts < maxAttempts) {
            referralCode = generateReferralCode();
            try {
              const existingCode = await prisma.user.findUnique({
                where: { referral_code: referralCode },
              });

              if (!existingCode) {
                isUnique = true;
              } else {
                attempts++;
              }
            } catch (error: any) {
              // If column doesn't exist, skip referral code generation
              if (error?.message?.includes('referral_code') && error?.message?.includes('does not exist')) {
                logger.warn('referral_code column does not exist, skipping referral code generation');
                referralCode = undefined;
                break;
              }
              throw error;
            }
          }

          if (!isUnique && referralCode) {
            throw new AppError('Failed to generate unique referral code', 500);
          }
        }

        // Create new user (with or without referral code depending on column existence)
        const userData: any = {
          name: data.name,
          email: data.email,
          mobile_number: normalizedMobileNumber,
          firebase_id: firebaseUid,
          device_id: data.deviceId || null,
          subscription_status: 'INACTIVE',
        };

        // If date of birth provided, validate and include it
        if (data.dob) {
          const parsed = new Date(data.dob);
          if (isNaN(parsed.getTime())) {
            throw new ValidationError('Invalid dob format. Use YYYY-MM-DD');
          }
          userData.dob = parsed;
        }

        // Only add referral code fields if column exists
        if (referralCodeColumnExists) {
          if (referralCode) {
            userData.referral_code = referralCode;
          }
          if (referredById) {
            userData.referred_by = referredById;
          }
          if (referredByAgentId) {
            userData.referred_by_agent = referredByAgentId;
          }
        }

        user = await prisma.user.create({
          data: userData,
        });
        const newUserId = user.id.toString();
        logger.info('New user created', {
          userId: newUserId,
          mobileNumber: normalizedMobileNumber,
          referralCode: referralCode || 'N/A (column not available)',
          referredBy: referredById?.toString() || null,
          referredByAgent: referredByAgentId?.toString() || null,
        });

        // Alert creation removed - alerts now only come from mobile app SMS reading
      }
    } else {
      // User exists by Firebase ID - check if we need to update details (e.g. if missing)
      const updateData: any = {};

      // Update device ID if provided
      if (data.deviceId) {
        updateData.device_id = data.deviceId;
      }

      // Update name if provided
      if (data.name) {
        updateData.name = data.name;
      }

      // Update DOB if provided
      if (data.dob) {
        const parsed = new Date(data.dob);
        if (!isNaN(parsed.getTime())) {
          updateData.dob = parsed;
        } else {
          logger.warn('Invalid DOB provided in update', { dob: data.dob });
        }
      }

      // Update email if provided and different
      if (data.email && data.email !== user.email) {
        const emailExists = await prisma.user.findFirst({
          where: {
            email: data.email,
            id: { not: user.id }
          },
        });

        if (!emailExists) {
          updateData.email = data.email;
        }
      }

      logger.info('Updating existing user details', {
        userId: user.id.toString(),
        updateDataKeys: Object.keys(updateData),
        hasDob: !!updateData.dob
      });

      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
        logger.info('User updated successfully', { dob: user.dob });
      } else {
        logger.info('No updates required for user');
      }
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id.toString(),
      firebaseUid: user.firebase_id,
      email: user.email || undefined,
      mobileNumber: user.mobile_number,
    });
    logger.info('User authenticated successfully', { userId: user.id.toString() });

    return {
      token,
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        mobileNumber: user.mobile_number,
        subscriptionStatus: user.subscription_status,
        dob: user.dob ? user.dob.toISOString().split('T')[0] : undefined,
      },
    };
  } catch (error) {
    logger.error('OTP verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      mobileNumber: data.mobileNumber,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Re-throw AppError instances (ValidationError, ConflictError, etc.)
    if (error instanceof AppError) {
      throw error;
    }

    // Handle Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as any;
      if (prismaError.code === 'P2002') {
        throw new ConflictError('A user with this information already exists');
      }
      if (prismaError.code === 'P2025') {
        throw new ValidationError('Record not found');
      }
    }

    // Handle Firebase errors
    if (error && typeof error === 'object' && 'code' in error) {
      const firebaseError = error as any;
      if (firebaseError.code?.startsWith('auth/')) {
        throw new ValidationError('Firebase authentication failed');
      }
    }

    // Generic error handling
    if (error instanceof Error) {
      throw new AppError(`OTP verification failed: ${error.message}`, 500);
    }

    throw new AppError('OTP verification failed: Unknown error', 500);
  }
};

