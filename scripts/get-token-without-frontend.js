/**
 * Script to get authentication token without frontend
 * 
 * This script uses the test authentication endpoint to get a JWT token
 * without needing a Firebase client app.
 * 
 * Usage:
 *   node scripts/get-token-without-frontend.js
 * 
 * Or with custom values:
 *   node scripts/get-token-without-frontend.js --mobile=9876543210 --name="John Doe" --dob=1990-01-15
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.findIndex(arg => arg.startsWith(flag));
  if (index === -1) return null;
  const value = args[index].split('=')[1];
  return value || args[index + 1];
};

const mobileNumber = getArg('--mobile') || '9876543210';
const name = getArg('--name') || 'Test User';
const dob = getArg('--dob') || '1990-01-15';

async function getToken() {
  try {
    console.log('🔐 Getting authentication token...\n');
    console.log('Request:', {
      mobileNumber,
      name,
      dob,
      url: `${BASE_URL}/test-auth/login`
    });
    console.log('');

    const response = await fetch(`${BASE_URL}/test-auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mobileNumber,
        name,
        dob,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Error:', data.error || data.message);
      process.exit(1);
    }

    if (data.success && data.data) {
      console.log('✅ Authentication successful!\n');
      console.log('📋 Token Information:');
      console.log('─'.repeat(50));
      console.log('JWT Token:', data.data.token);
      console.log('');
      console.log('👤 User Information:');
      console.log('─'.repeat(50));
      console.log('ID:', data.data.user.id);
      console.log('Name:', data.data.user.name);
      console.log('Mobile:', data.data.user.mobileNumber);
      console.log('Email:', data.data.user.email || 'N/A');
      console.log('Subscription:', data.data.user.subscriptionStatus);
      console.log('');
      
      if (data.data.customToken) {
        console.log('🔑 Custom Token (for Firebase client):', data.data.customToken);
        console.log('');
      }

      console.log('📝 Use this token in Postman:');
      console.log(`Authorization: Bearer ${data.data.token}`);
      console.log('');
      console.log('💡 Copy the token above and paste it in your Postman request headers');
      
      return data.data.token;
    } else {
      console.error('❌ Unexpected response:', data);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    console.error('');
    console.error('💡 Make sure:');
    console.error('   1. Your server is running on', BASE_URL);
    console.error('   2. NODE_ENV is not set to "production"');
    console.error('   3. Firebase is properly configured');
    process.exit(1);
  }
}

// Run the script
getToken();

