/**
 * Test Authentication Script
 * 
 * This script tests the authentication flow and prints the token
 * so you can manually copy it to Postman if needed.
 * 
 * Usage:
 *   npx ts-node scripts/test-auth.ts
 */

import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testAuth() {
  try {
    console.log('🔐 Testing Authentication...\n');
    console.log(`📍 Server: ${BASE_URL}\n`);

    // Test user login
    console.log('1️⃣ Testing User Login (Test Auth)...');
    const loginResponse = await axios.post(`${BASE_URL}/test-auth/login`, {
      mobileNumber: '9876543210',
      name: 'Test User',
      dob: '1990-01-15',
    });

    if (loginResponse.data.success && loginResponse.data.data.token) {
      console.log('✅ User Login Successful!\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 USER TOKEN (Copy this to Postman authToken):');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(loginResponse.data.data.token);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Test protected endpoint
      console.log('2️⃣ Testing Protected Endpoint...');
      const profileResponse = await axios.get(`${BASE_URL}/user/profile`, {
        headers: {
          Authorization: `Bearer ${loginResponse.data.data.token}`,
        },
      });

      if (profileResponse.data.success) {
        console.log('✅ Protected Endpoint Works!');
        console.log('   User Profile:', JSON.stringify(profileResponse.data.data, null, 2));
      }
    } else {
      console.log('❌ Login failed:', loginResponse.data);
    }

    console.log('\n');

    // Test admin login
    console.log('3️⃣ Testing Admin Login...');
    const adminLoginResponse = await axios.post(`${BASE_URL}/admin/login`, {
      email: 'admin@claimley.com',
      password: 'admin123',
    });

    if (adminLoginResponse.data.success && adminLoginResponse.data.data.token) {
      console.log('✅ Admin Login Successful!\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 ADMIN TOKEN (Copy this to Postman adminToken):');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(adminLoginResponse.data.data.token);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } else {
      console.log('❌ Admin login failed:', adminLoginResponse.data);
    }
  } catch (error: any) {
    if (error.response) {
      console.error('❌ Error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('❌ No response from server. Is the server running?');
      console.error('   Run: npm run dev');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

testAuth();

