import { Router, Request, Response } from 'express';
import admin from '../config/firebase';
import prisma from '../config/prismaClient';
import { generateToken } from '../utils/jwt';
import logger from '../config/logger';

const router = Router();

/**
 * TEST ENDPOINT ONLY - For development/testing without frontend
 * 
 * This endpoint allows you to authenticate without Firebase client SDK.
 * It creates a Firebase user if needed and returns a JWT token directly.
 * 
 * ⚠️ WARNING: This should only be enabled in development/test environments!
 * 
 * Usage:
 * POST /test-auth/login
 * Body: {
 *   "mobileNumber": "9876543210",
 *   "name": "Test User",
 *   "dob": "1990-01-15"
 * }
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  // Only allow in development/test
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({
      success: false,
      error: 'This endpoint is disabled in production',
    });
    return;
  }

  try {
    const { mobileNumber, name, dob } = req.body;

    if (!mobileNumber || !name || !dob) {
      res.status(400).json({
        success: false,
        error: 'mobileNumber, name, and dob are required',
      });
      return;
    }

    // Validate mobile number format
    if (!/^[0-9]{10}$/.test(mobileNumber)) {
      res.status(400).json({
        success: false,
        error: 'Invalid mobile number format. Must be 10 digits.',
      });
      return;
    }

    logger.info('Test auth login attempt', { mobileNumber });

    // Check if user exists in database
    let user = await prisma.user.findUnique({
      where: { mobile_number: mobileNumber },
    });

    let firebaseUid: string;

    if (user && user.firebase_id) {
      // User exists, use existing Firebase UID
      firebaseUid = user.firebase_id;
      logger.info('Existing user found', { userId: user.id.toString(), firebaseUid });
    } else {
      // Create new Firebase user
      try {
        // Check if Firebase user already exists by email (if we have one)
        // For phone auth, we'll create a user with a generated email
        const firebaseUser = await admin.auth().createUser({
          phoneNumber: `+91${mobileNumber}`, // Assuming Indian numbers, adjust as needed
          displayName: name,
          disabled: false,
        });
        firebaseUid = firebaseUser.uid;
        logger.info('Firebase user created', { firebaseUid });
      } catch (error: any) {
        // If user already exists in Firebase, try to get it
        if (error.code === 'auth/phone-number-already-exists') {
          // Try to find user by phone number
          const users = await admin.auth().listUsers(1000);
          const existingUser = users.users.find(
            (u) => u.phoneNumber === `+91${mobileNumber}` || u.phoneNumber === mobileNumber
          );
          if (existingUser) {
            firebaseUid = existingUser.uid;
            logger.info('Found existing Firebase user', { firebaseUid });
          } else {
            throw new Error('Firebase user exists but could not be retrieved');
          }
        } else {
          throw error;
        }
      }

      // Create or update user in database
      if (user) {
        // Update existing user with Firebase UID
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            firebase_id: firebaseUid,
            name,
            dob: new Date(dob),
          },
        });
      } else {
        // Create new user
        user = await prisma.user.create({
          data: {
            name,
            dob: new Date(dob),
            mobile_number: mobileNumber,
            firebase_id: firebaseUid,
            subscription_status: 'INACTIVE',
          },
        });
        logger.info('New user created', { userId: user.id.toString() });
      }
    }

    // Generate a custom token that can be exchanged for an idToken
    // Note: For testing, we'll directly generate JWT token
    // In production, you'd exchange custom token for idToken on client
    const customToken = await admin.auth().createCustomToken(firebaseUid);

    // Generate our JWT token (same as what verifyOTP returns)
    const token = generateToken({
      userId: user.id.toString(),
      firebaseUid: user.firebase_id,
      email: user.email || undefined,
      mobileNumber: user.mobile_number,
    });

    logger.info('Test auth successful', { userId: user.id.toString() });

    res.status(200).json({
      success: true,
      data: {
        token,
        customToken, // This can be exchanged for idToken on client if needed
        user: {
          id: user.id.toString(),
          name: user.name,
          email: user.email,
          mobileNumber: user.mobile_number,
          subscriptionStatus: user.subscription_status,
        },
      },
    });
  } catch (error: any) {
    logger.error('Test auth failed', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      error: error.message || 'Test authentication failed',
    });
  }
});

/**
 * Generate Firebase ID Token from custom token
 * This endpoint exchanges a custom token for an idToken
 * 
 * POST /test-auth/exchange-token
 * Body: {
 *   "customToken": "firebase-custom-token"
 * }
 */
router.post('/exchange-token', async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({
      success: false,
      error: 'This endpoint is disabled in production',
    });
    return;
  }

  try {
    const { customToken } = req.body;

    if (!customToken) {
      res.status(400).json({
        success: false,
        error: 'customToken is required',
      });
      return;
    }

    // Exchange custom token for idToken using Firebase REST API
    // Note: This requires FIREBASE_API_KEY (Web API Key) from Firebase Console
    const apiKey = process.env.FIREBASE_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        success: false,
        error: 'FIREBASE_API_KEY not configured. Get it from Firebase Console > Project Settings > General',
      });
      return;
    }

    // Use Node.js built-in https module (works in all Node versions)
    const https = require('https');
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`;
    
    const postData = JSON.stringify({
      token: customToken,
      returnSecureToken: true,
    });

    const data = await new Promise((resolve, reject) => {
      const req = https.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }, (res: any) => {
        let body = '';
        res.on('data', (chunk: string) => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      });
      
      req.on('error', reject);
      req.write(postData);
      req.end();
    }) as any;

    if (data.error) {
      res.status(400).json({
        success: false,
        error: data.error.message || 'Failed to exchange token',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        idToken: data.idToken,
        refreshToken: data.refreshToken,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Token exchange failed',
    });
  }
});

export default router;

