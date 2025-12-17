import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin SDK
// Note: You'll need to set up Firebase credentials
// Option 1: Service Account JSON file
// const serviceAccount = require('./path-to-serviceAccountKey.json');
// admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

// Option 2: Environment variables (recommended for production)
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      // Handle private key formatting - replace escaped newlines and ensure proper formatting
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      
      // Replace escaped newlines
      privateKey = privateKey.replace(/\\n/g, '\n');
      
      // If the key doesn't start with -----BEGIN, it might need proper formatting
      // Ensure the key has proper line breaks
      if (!privateKey.includes('-----BEGIN')) {
        console.warn('Firebase private key may be malformed. Ensure it includes BEGIN/END markers.');
      }
      
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: privateKey,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
      console.log('Firebase Admin initialized successfully');
    } else {
      // For development, you can use a service account file
      // admin.initializeApp({ credential: admin.credential.applicationDefault() });
      console.warn('Firebase Admin not initialized. Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL in .env');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Firebase Admin initialization error:', errorMessage);
    console.error('Firebase Admin initialization stack:', errorStack);
    // Don't crash the app if Firebase fails to initialize, but log it clearly
    console.warn('⚠️  WARNING: Continuing without Firebase Admin initialization. Authentication will fail!');
    throw new Error(`Firebase Admin initialization failed: ${errorMessage}`);
  }
}

export default admin;

