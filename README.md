# Claimley Backend API

Node.js + Express + Prisma + TypeScript backend for Claimley application.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MySQL database
- Firebase project with Authentication enabled

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DATABASE_URL="mysql://user:password@localhost:3306/claimly"

# JWT Configuration
JWT_SECRET="your_jwt_secret_change_this_in_production"

# Firebase Admin SDK Configuration
# Get these from Firebase Console > Project Settings > Service Accounts
FIREBASE_PROJECT_ID="your-firebase-project-id"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"

# Server Configuration
PORT=3000
NODE_ENV=development
```

3. Set up the database:
```bash
# Run migrations
npm run migrate

# Or manually:
npx prisma migrate dev --name init --schema=./src/prisma/schema.prisma
```

4. Generate Prisma Client:
```bash
npm run prisma:generate
```

5. Start the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3000` (or the PORT specified in your .env file).

## 📝 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run migrate` - Run database migrations
- `npm run migrate:deploy` - Deploy migrations (for production)
- `npm run migrate:reset` - Reset database (⚠️ destructive)
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:studio` - Open Prisma Studio (database GUI)
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report

## 📚 API Endpoints

### Authentication

#### POST `/auth/verify-otp`
Verify Firebase OTP and get JWT token.

**Request Body:**
```json
{
  "idToken": "firebase-id-token",
  "mobileNumber": "1234567890",
  "name": "John Doe",        // Required for new users
  "dob": "1990-01-01",       // Required for new users (YYYY-MM-DD)
  "deviceId": "device-id"    // Optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt-token",
    "user": {
      "id": "1",
      "name": "John Doe",
      "email": "john@example.com",
      "mobileNumber": "1234567890",
      "subscriptionStatus": "INACTIVE"
    }
  }
}
```

### User Profile (Protected - Requires JWT Token)

#### GET `/user/profile`
Get current user profile.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "1",
    "name": "John Doe",
    "dob": "1990-01-01",
    "email": "john@example.com",
    "mobileNumber": "1234567890",
    "deviceId": "device-id",
    "subscriptionStatus": "INACTIVE",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### PUT `/user/profile`
Update user profile.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "name": "John Doe",        // Optional
  "dob": "1990-01-01",       // Optional (YYYY-MM-DD)
  "email": "john@example.com", // Optional
  "deviceId": "device-id"    // Optional
}
```

### Subscription (Protected - Requires JWT Token)

#### GET `/user/subscription`
Get current subscription status.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "ACTIVE",
    "subscription": {
      "id": "1",
      "planName": "Premium",
      "amount": "999.00",
      "paymentId": "payment-id",
      "transactionDate": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### GET `/user/subscription?all=true`
Get all subscription history.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

### Health Check

#### GET `/health`
Check server status.

**Response:**
```json
{
  "status": "OK",
  "message": "Server is running"
}
```

## 🏗️ Project Structure

```
src/
├── config/              # Configuration files
│   ├── firebase.ts      # Firebase Admin SDK setup
│   └── prismaClient.ts  # Prisma client singleton
├── controllers/         # Request handlers
│   ├── auth.controller.ts
│   └── user.controller.ts
├── middlewares/         # Express middlewares
│   ├── auth.middleware.ts      # JWT authentication
│   └── validation.middleware.ts # Request validation
├── routes/              # Route definitions
│   ├── auth.routes.ts
│   └── user.routes.ts
├── services/            # Business logic
│   ├── auth.service.ts
│   └── user.service.ts
├── utils/               # Utility functions
│   ├── errors.ts        # Custom error classes
│   └── jwt.ts           # JWT utilities
├── prisma/              # Database schema
│   └── schema.prisma
└── index.ts             # Express app entry point
```

## 🔒 Security Features

- JWT token-based authentication
- Firebase OTP verification
- Request validation middleware
- Password hashing (bcrypt ready)
- CORS configuration
- Environment variable protection

## 🛠️ Technologies Used

- **Node.js** - Runtime environment
- **Express** - Web framework
- **TypeScript** - Type safety
- **Prisma** - ORM and database toolkit
- **MySQL** - Database
- **Firebase Admin SDK** - OTP verification
- **JWT** - Token-based authentication

## 🧪 Testing

The project uses Jest for testing. Test files are located in `src/__tests__/`.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Structure

- Unit tests for services
- Validation schema tests
- Integration tests (can be added)

## 🔒 Security Features

### Rate Limiting

- **General API**: 100 requests per 15 minutes per IP
- **Authentication**: 5 requests per 15 minutes per IP
- **Admin**: 200 requests per 15 minutes per IP
- **File Uploads**: 20 uploads per hour per IP

### Validation

- Zod schema validation for all endpoints
- Type-safe request validation
- Automatic error responses for invalid data

### Logging

- Winston logger configured
- Request/response logging
- Error logging with stack traces
- Log files: `logs/error.log` and `logs/combined.log`

## 📊 Performance Optimizations

### Prisma Query Optimization

- Optimized queries with proper `include` statements
- Batch fetching helpers
- Reduced N+1 query problems
- Query helpers in `src/utils/prismaOptimizer.ts`

### Database Indexing

The Prisma schema includes indexes on:
- User email, mobile_number, firebase_uid
- Policy policy_number
- All foreign key relationships

## 📄 License

ISC

