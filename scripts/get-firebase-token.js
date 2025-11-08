/**
 * Helper script to get Firebase ID Token for testing
 * 
 * This script helps you get a Firebase ID token for Postman testing.
 * You need to have Firebase configured in your client app.
 * 
 * Usage:
 * 1. Run this in your client app's console after Firebase authentication
 * 2. Or integrate this into a test helper endpoint
 */

// For React Native / Expo
// After Firebase phone authentication succeeds:
import { getAuth } from 'firebase/auth';

const auth = getAuth();
const user = auth.currentUser;

if (user) {
  user.getIdToken().then(token => {
    console.log('Firebase ID Token:', token);
    console.log('Copy this token and use it in Postman');
  });
}

// For Web (Firebase v9+)
// import { getAuth } from 'firebase/auth';
// const auth = getAuth();
// const user = auth.currentUser;
// if (user) {
//   user.getIdToken().then(token => {
//     console.log('Firebase ID Token:', token);
//   });
// }

// For Web (Firebase v8)
// firebase.auth().currentUser.getIdToken().then(token => {
//   console.log('Firebase ID Token:', token);
// });

// For Flutter
// FirebaseAuth.instance.currentUser?.getIdToken().then((token) {
//   print('Firebase ID Token: $token');
// });

