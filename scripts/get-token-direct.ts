/**
 * Direct Firebase authentication script
 * 
 * This script uses Firebase Admin SDK to create a user and get a token
 * without needing the test endpoint.
 * 
 * Requires:
 * - Firebase Admin SDK configured in .env
 * - Prisma client generated
 * 
 * Usage:
 *   npx ts-node scripts/get-token-direct.ts
 */

import dotenv from 'dotenv';
import admin from '../src/config/firebase';
import prisma from '../src/config/prismaClient';
import { generateToken } from '../src/utils/jwt';

dotenv.config();

const mobileNumber = process.argv[2] || '9876543210';
const name = process.argv[3] || 'Test User';
const dob = process.argv[4] || '1990-01-15';

async function getTokenDirect() {
  try {
    console.log('🔐 Getting authentication token directly...\n');

    // Check if user exists in database
    let user = await prisma.user.findUnique({
      where: { mobile_number: mobileNumber },
    });

    let firebaseUid: string;

    if (user && user.firebase_uid) {
      // User exists, use existing Firebase UID
      firebaseUid = user.firebase_uid;
      console.log('✅ Found existing user:', user.id.toString());
    } else {
      // Create new Firebase user
      try {
        const firebaseUser = await admin.auth().createUser({
          phoneNumber: `+91${mobileNumber}`, // Adjust country code as needed
          displayName: name,
          disabled: false,
        });
        firebaseUid = firebaseUser.uid;
        console.log('✅ Created Firebase user:', firebaseUid);
      } catch (error: any) {
        if (error.code === 'auth/phone-number-already-exists') {
          // Try to find user by phone number
          const users = await admin.auth().listUsers(1000);
          const existingUser = users.users.find(
            (u) => u.phoneNumber === `+91${mobileNumber}` || u.phoneNumber === mobileNumber
          );
          if (existingUser) {
            firebaseUid = existingUser.uid;
            console.log('✅ Found existing Firebase user:', firebaseUid);
          } else {
            throw new Error('Firebase user exists but could not be retrieved');
          }
        } else {
          throw error;
        }
      }

      // Create or update user in database
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            firebase_uid: firebaseUid,
            name,
            dob: new Date(dob),
          },
        });
      } else {
        user = await prisma.user.create({
          data: {
            name,
            dob: new Date(dob),
            mobile_number: mobileNumber,
            firebase_uid: firebaseUid,
            subscription_status: 'INACTIVE',
          },
        });
        console.log('✅ Created database user:', user.id.toString());
      }
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id.toString(),
      firebaseUid: user.firebase_uid,
      email: user.email || undefined,
      mobileNumber: user.mobile_number,
    });

    console.log('\n📋 Token Information:');
    console.log('─'.repeat(50));
    console.log('JWT Token:', token);
    console.log('');
    console.log('👤 User Information:');
    console.log('─'.repeat(50));
    console.log('ID:', user.id.toString());
    console.log('Name:', user.name);
    console.log('Mobile:', user.mobile_number);
    console.log('Email:', user.email || 'N/A');
    console.log('Subscription:', user.subscription_status);
    console.log('');
    console.log('📝 Use this token in Postman:');
    console.log(`Authorization: Bearer ${token}`);

    await prisma.$disconnect();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
}

getTokenDirect();

