# Postman Collection Guide - Claimley API

## Overview

This Postman collection contains all API endpoints for the Claimley Insurance Policy Management System. The collection is organized into logical folders for easy navigation.

## Setup Instructions

### 1. Import the Collection

1. Open Postman
2. Click **Import** button (top left)
3. Select the `Claimley_API.postman_collection.json` file
4. The collection will appear in your workspace

### 2. Configure Environment Variables ⚠️ REQUIRED!

The collection uses three variables:

- **`baseUrl`**: Base URL of your API (default: `http://localhost:3000`)
- **`authToken`**: JWT token for user authentication (auto-populated after login)
- **`adminToken`**: JWT token for admin authentication (auto-populated after admin login)

**To set up environment variables (MUST DO THIS FIRST!):**

1. Click on the **Environments** tab in Postman (left sidebar, looks like an eye icon 👁️)
2. Click the **"+"** button to create a new environment
3. Name it **"Local Development"**
4. Add the following variables (click "Add" for each):
   - Variable: `baseUrl` | Initial Value: `http://localhost:3000` | Current Value: `http://localhost:3000`
   - Variable: `authToken` | Initial Value: (leave empty) | Current Value: (leave empty)
   - Variable: `adminToken` | Initial Value: (leave empty) | Current Value: (leave empty)
5. Click **"Save"**
6. **IMPORTANT:** Select this environment from the dropdown in the **top right corner** of Postman (next to the eye icon)

**For production:**
- Change `baseUrl` to your production URL (e.g., `https://api.claimley.com`)

**⚠️ If you skip this step, you'll get "Unauthorized: No token provided" errors!**

## Collection Structure

### 1. **Health Check**
- Simple endpoint to verify server is running

### 2. **Authentication** 🔐

**⚠️ YOU MUST LOGIN FIRST BEFORE USING ANY PROTECTED ENDPOINTS!**

- **Test Login (No Frontend Required)** ⭐ EASIEST WAY
  - Go to: `Authentication → Test Login (No Frontend Required)`
  - Body: `{ "mobileNumber": "9876543210", "name": "Test User", "dob": "1990-01-15" }`
  - Click Send
  - Token is automatically saved to `authToken` variable
  - **Use this for testing - no Firebase needed!**

- **Verify OTP**: Authenticates user with Firebase OTP
  - Automatically saves token to `authToken` variable
  - Requires Firebase `idToken` from client
  - More complex - use Test Login instead for quick testing

### 3. **User Management**
- Get Profile
- Update Profile
- Get User by ID
- Update User by ID
- Get Subscription

### 4. **Policies**
- Create Policy
- Get All Policies
- Get Policy by ID
- Update Policy
- Delete Policy

### 5. **Nominees**
- Create Nominee
- Get All Nominees
- Get Nominee by ID
- Update Nominee
- Delete Nominee

**Relationship types:** `SPOUSE`, `CHILD`, `PARENT`, `SIBLING`, `FRIEND`, `OTHER`

### 6. **Policy-Nominee Linking**
- Get Policy Nominees
- Link Nominee to Policy (with share percentage)
- Update Nominee Share Percentage
- Unlink Nominee from Policy

### 7. **Documents**
Three subfolders for different document types:

#### User Documents
- Upload, Get All, Get by ID, Delete
- **Document types:** `AADHAAR`, `PAN`, `OTHER`

#### Policy Documents
- Upload, Get All, Get by ID, Delete
- **Document types:** `POLICY_COPY`, `RECEIPT`, `OTHER`

#### Nominee Documents
- Upload, Get All, Get by ID, Delete
- **Document types:** `NOMINEE_ID`, `ADDRESS_PROOF`, `OTHER`

**Note:** File uploads use `multipart/form-data`. Maximum file size: 10MB.

### 8. **Subscriptions**
- Create Subscription
- Payment status: `SUCCESS`, `PENDING`, `FAILED`

### 9. **Alerts**
- Create Alert (system or admin)
- Get Alert by ID
- Verify Alert (admin only)

**Detected via:** `SMS`, `MANUAL`
**Verification status:** `VERIFIED`, `FALSE_ALERT`

### 10. **Admin**
All admin endpoints require admin authentication.

#### Admin Authentication
- **Admin Login**: Logs in admin user
  - Automatically saves token to `adminToken` variable

#### Admin Users
- Get All Users
- Get User by ID
- Update User Status

#### Admin Alerts
- Get Alert Stats
- Get All Alerts
- Get Alert by ID
- Verify Alert

#### Admin Actions
- Create Admin Action
- Get All Admin Actions
- Get Admin Action by ID

#### Admin Companies
- Create Company
- Get All Companies
- Get Company by ID
- Update Company
- Delete Company

#### Admin Policies
- Get All Policies (across all users)

#### Admin Documents
- Verify Document
- Document types: `user`, `policy`, `nominee`

## Authentication Flow

### User Authentication

#### 🎯 Option 0: Test Login (No Frontend Required) - **RECOMMENDED FOR TESTING**

The easiest way to authenticate without a frontend is to use the test login endpoint:

**Using Postman:**
1. Use the **"Test Login (No Frontend Required)"** endpoint in the Authentication folder
2. Send a POST request to `{{baseUrl}}/test-auth/login`
3. Request body:
   ```json
   {
     "mobileNumber": "9876543210",
     "name": "Test User",
     "dob": "1990-01-15"
   }
   ```
4. The response will include a JWT token that's automatically saved to `authToken`
5. Use this token for all subsequent requests!

**Using Command Line:**
```bash
# Method 1: Using npm script (calls the test endpoint)
npm run test:token

# Method 2: Using npm script with custom values
npm run test:token -- --mobile=9876543210 --name="John Doe" --dob=1990-01-15

# Method 3: Direct script (uses Admin SDK directly)
npm run test:token-direct
```

**Requirements:**
- Server must be running (`npm run dev`)
- `NODE_ENV` must NOT be set to `"production"` (development mode)
- Firebase Admin SDK must be configured in `.env`

**Note:** This endpoint is automatically disabled in production for security.

#### Getting Firebase `idToken` for Testing (If you need the original endpoint)

The Firebase `idToken` is obtained from Firebase Authentication on the client side after a user completes phone number authentication. Here are your options for getting it in Postman:

**Option 1: Use Your Mobile App (Recommended for Testing)**
1. Use your mobile app (React Native, Flutter, etc.) with Firebase configured
2. Complete phone authentication (enter phone number, receive OTP, verify OTP)
3. After successful authentication, Firebase will provide an `idToken`
4. Log or copy the `idToken` from your app
5. Use it in Postman for the `/auth/verify-otp` request

**Option 2: Use Firebase Admin SDK (For Development/Testing)**
If you need to generate test tokens for development, you can create a temporary endpoint or script:

```javascript
// Temporary helper endpoint (add to your routes for testing only)
const admin = require('firebase-admin');
const customToken = await admin.auth().createCustomToken(firebaseUid);
// Then exchange customToken for idToken using Firebase client SDK
```

**Option 3: Use Firebase REST API (Alternative)**
1. Authenticate with Firebase using REST API to get an ID token
2. Use the token in your Postman request

**Option 4: Browser Console (If Testing Web App)**
If you have a web client:
1. Open browser DevTools Console
2. After Firebase authentication, run:
   ```javascript
   firebase.auth().currentUser.getIdToken().then(token => console.log(token));
   ```
3. Copy the token and use it in Postman

**Important Notes:**
- The `idToken` is a JWT token issued by Firebase after successful phone authentication
- It expires after 1 hour (Firebase default)
- You need the same Firebase project configured in your backend
- The token contains the user's Firebase UID (`firebase_id`) which is used to identify the user in your database

#### Verify OTP Endpoint

1. **Verify OTP** (`POST /auth/verify-otp`)
   - Requires Firebase `idToken` from client (see above for how to get it)
   - Requires `mobileNumber` (10 digits, e.g., "9876543210")
   - Optional: `name`, `dob` (required for new users only)
   - Optional: `deviceId`
   - Returns JWT token
   - Token is automatically saved to `authToken` variable
   - Use this token in `Authorization: Bearer {{authToken}}` header for user endpoints

**Example Request Body:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...", // Firebase ID token from client
  "mobileNumber": "9876543210",
  "name": "John Doe",           // Required for new users
  "dob": "1990-01-15",           // Required for new users (YYYY-MM-DD)
  "deviceId": "device-12345"     // Optional
}
```

**For Existing Users:**
- `name` and `dob` are optional (not required)
- Backend will verify the Firebase token and find the user by `firebase_id`
- Returns JWT token for API access

**For New Users:**
- `name` and `dob` are required
- Backend creates a new user record
- Returns JWT token for API access

### Admin Authentication

1. **Admin Login** (`POST /admin/login`)
   - Requires email and password
   - Returns admin JWT token
   - Token is automatically saved to `adminToken` variable
   - Use this token in `Authorization: Bearer {{adminToken}}` header for admin endpoints

## Common Request Patterns

### JSON Request Body
Most endpoints use JSON format:
```json
{
  "field1": "value1",
  "field2": "value2"
}
```

### File Upload
Document upload endpoints use `multipart/form-data`:
- `file`: The actual file (select file in Postman)
- `documentType`: Enum value (e.g., "AADHAAR")
- `documentName`: String (e.g., "Aadhaar Card")

### Path Parameters
Replace path variables like `:id`, `:policyId`, `:nomineeId` with actual IDs:
- Example: `{{baseUrl}}/policies/:id` → `{{baseUrl}}/policies/123`

## Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data here
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "details": [
    {
      "path": "field.path",
      "message": "Validation error message"
    }
  ]
}
```

## Testing Workflow

### Typical User Flow

1. **Authenticate**
   - Call `Verify OTP` to get user token

2. **Create Policy**
   - Call `Create Policy` with insurance company ID

3. **Create Nominee**
   - Call `Create Nominee` with nominee details

4. **Link Nominee to Policy**
   - Call `Link Nominee to Policy` with policy ID and nominee ID

5. **Upload Documents**
   - Upload user documents
   - Upload policy documents
   - Upload nominee documents

### Typical Admin Flow

1. **Admin Login**
   - Call `Admin Login` to get admin token

2. **View Users**
   - Call `Get All Users` to see all registered users

3. **View Alerts**
   - Call `Get All Alerts` to see all alerts
   - Call `Verify Alert` to verify an alert

4. **Manage Companies**
   - Create, update, or delete insurance companies

## Rate Limiting

The API implements rate limiting:
- General API: Standard rate limit
- Auth endpoints: Stricter rate limit
- Admin endpoints: Admin-specific rate limit
- Upload endpoints: Upload-specific rate limit

If you hit rate limits, you'll receive a `429 Too Many Requests` response.

## Troubleshooting

### Token Not Working
- Check if token is saved in environment variables
- Verify token hasn't expired
- Re-authenticate to get a new token

### File Upload Errors
- Ensure file size is under 10MB
- Use field name `file` (not `document` or `upload`)
- Check document type enum values are correct

### 404 Not Found
- Verify base URL is correct
- Check path parameters are replaced with actual IDs
- Ensure endpoint URL matches the route definition

### 401 Unauthorized
- Verify token is included in `Authorization` header
- Check token format: `Bearer {{authToken}}`
- Ensure token hasn't expired

### Validation Errors
- Check request body matches schema requirements
- Verify enum values are correct
- Ensure required fields are provided
- Check date formats (YYYY-MM-DD for dates, ISO 8601 for datetime)

## Next Steps

1. Import the collection into Postman
2. Set up environment variables
3. Start with Health Check endpoint
4. Authenticate (user or admin)
5. Explore endpoints based on your needs

For more details about the API, see the main `README.md` file.

