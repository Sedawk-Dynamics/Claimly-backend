import admin from '../config/firebase';
import prisma from '../config/prismaClient';
import { generateToken } from '../utils/jwt';
import { ValidationError, ConflictError, AppError } from '../utils/errors';
import logger from '../config/logger';

export interface VerifyOTPRequest {
  idToken: string; // Firebase ID token from client
  mobileNumber: string;
  name?: string;
  dob?: string;
  deviceId?: string;
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

    // Check if user exists in database
    let user = await prisma.user.findUnique({
      where: { firebase_id: firebaseUid },
    });

    // If user doesn't exist, create a new user
    if (!user) {
      // Validate required fields for new user
      if (!data.name || !data.dob) {
        throw new ValidationError('Name and date of birth are required for new users');
      }

      // Check if mobile number already exists
      const existingUser = await prisma.user.findUnique({
        where: { mobile_number: data.mobileNumber },
      });

      if (existingUser) {
        throw new ConflictError('Mobile number already registered');
      }

      // Create new user
      user = await prisma.user.create({
        data: {
          name: data.name,
          dob: new Date(data.dob),
          email: decodedToken.email || null,
          mobile_number: data.mobileNumber,
          firebase_id: firebaseUid,
          device_id: data.deviceId || null,
          subscription_status: 'INACTIVE',
        },
      });
      logger.info('New user created', { userId: user.id.toString(), mobileNumber: data.mobileNumber });
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

