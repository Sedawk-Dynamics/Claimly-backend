import admin from '../config/firebase';
import prisma from '../config/prismaClient';
import { generateToken } from '../utils/jwt';
import { ValidationError, ConflictError, AppError } from '../utils/errors';
import logger from '../config/logger';
import { createAlert } from './alert.service';
import { generateReferralCode, isValidReferralCodeFormat } from '../utils/referral';

export interface VerifyOTPRequest {
  idToken: string; // Firebase ID token from client
  mobileNumber: string;
  name?: string;
  email?: string;
  deviceId?: string;
  referralCode?: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string | null;
    mobileNumber: string;
    subscriptionStatus: string;
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
        user = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            firebase_id: firebaseUid,
            device_id: data.deviceId || existingUser.device_id,
          },
        });
        logger.info('Linked Firebase ID to existing user', { 
          userId: user.id.toString(), 
          mobileNumber: normalizedMobileNumber 
        });
      } else {
        // User doesn't exist at all - require name and email for new user
        if (!data.name || !data.email) {
          throw new ValidationError('Name and email are required for new users');
        }

        // Check if email already exists
        const existingEmailUser = await prisma.user.findFirst({
          where: { email: data.email },
        });

        if (existingEmailUser) {
          throw new ConflictError('Email already registered');
        }

        // Validate and find referrer if referral code is provided
        let referredById: bigint | null = null;
        let referralCode: string | undefined;
        let referralCodeExpiresAt: Date | undefined;
        
        // Check if referral_code column exists by trying a simple query
        let referralCodeColumnExists = false;
        try {
          // Try to query referral_code to see if column exists
          await prisma.$queryRaw`SELECT referral_code FROM \`User\` LIMIT 1`;
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
            const referrer = await prisma.user.findUnique({
              where: { referral_code: data.referralCode.toUpperCase() },
              select: { id: true, referral_code_expires_at: true },
            });

            if (!referrer) {
              throw new ValidationError('Invalid referral code');
            }

            // Check if referral code has expired
            if (referrer.referral_code_expires_at) {
              const now = new Date();
              const expiresAt = new Date(referrer.referral_code_expires_at);
              if (expiresAt <= now) {
                throw new ValidationError('This referral code has expired');
              }
            }

            referredById = referrer.id;
            logger.info('Referral code validated', { 
              referralCode: data.referralCode, 
              referrerId: referrer.id.toString() 
            });
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

          // Set expiration to 30 days from now
          if (referralCode) {
            referralCodeExpiresAt = new Date();
            referralCodeExpiresAt.setDate(referralCodeExpiresAt.getDate() + 30);
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

        // Only add referral code fields if column exists
        if (referralCodeColumnExists) {
          if (referralCode) {
            userData.referral_code = referralCode;
          }
          if (referralCodeExpiresAt) {
            userData.referral_code_expires_at = referralCodeExpiresAt;
          }
          if (referredById) {
            userData.referred_by = referredById;
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
        });

        // Create alert for admin panel
        await createAlert({
          userId: newUserId,
          detectedVia: 'MANUAL',
          remarks: `New user registered: ${data.name} (${data.mobileNumber})`,
        }).catch((err) => {
          // Don't fail the request if alert creation fails
          logger.error('Failed to create alert for new user', { error: err, userId: newUserId });
        });
      }
    } else {
      // Update device ID if provided
      if (data.deviceId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { device_id: data.deviceId },
        });
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

