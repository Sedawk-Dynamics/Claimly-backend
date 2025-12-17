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

export const verifyOTP = async (data: VerifyOTPRequest): Promise<AuthResponse> => {
  try {
    logger.info('OTP verification attempt', { mobileNumber: data.mobileNumber });
    
    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(data.idToken);
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
        where: { mobile_number: data.mobileNumber },
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
          mobileNumber: data.mobileNumber 
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
        if (data.referralCode) {
          if (!isValidReferralCodeFormat(data.referralCode)) {
            throw new ValidationError('Invalid referral code');
          }

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
        }

        // Generate unique referral code for new user
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

        // Create new user with referral code
        user = await prisma.user.create({
          data: {
            name: data.name,
            email: data.email,
            mobile_number: data.mobileNumber,
            firebase_id: firebaseUid,
            device_id: data.deviceId || null,
            subscription_status: 'INACTIVE',
            referral_code: referralCode,
            referral_code_expires_at: expiresAt,
            referred_by: referredById || null,
          },
        });
        const newUserId = user.id.toString();
        logger.info('New user created', { 
          userId: newUserId, 
          mobileNumber: data.mobileNumber,
          referralCode: referralCode,
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
    });

    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new AppError(`OTP verification failed: ${error.message}`, 500);
    }

    throw new AppError('OTP verification failed: Unknown error', 500);
  }
};

