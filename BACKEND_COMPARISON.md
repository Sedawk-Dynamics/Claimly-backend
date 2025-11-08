# 📋 Backend Documentation vs Implementation Comparison

## ✅ **What's Already Implemented**

### 1. **Core Architecture** ✅
- ✅ Layered architecture (routes → controllers → services)
- ✅ TypeScript + Express.js setup
- ✅ Prisma ORM with MySQL
- ✅ Firebase Admin SDK configuration
- ✅ JWT authentication utilities
- ✅ Middleware structure (auth, validation, rate limiting, error handling)

### 2. **Database Schema** ✅
All tables from documentation exist:
- ✅ `users`, `subscriptions`, `insurance_companies`
- ✅ `policies`, `nominees`, `policy_nominees`
- ✅ `user_documents`, `policy_documents`, `nominee_documents`
- ✅ `deceased_alerts`, `admin_actions`, `admins`

### 3. **Authentication & Security** ✅
- ✅ Firebase OTP verification (`POST /auth/verify-otp`)
- ✅ JWT token generation (7 days expiry - note: docs say 24 hours)
- ✅ Admin authentication with bcrypt
- ✅ Role-based access control (SUPER_ADMIN, STAFF)
- ✅ Rate limiting middleware
- ✅ CORS configuration
- ✅ Error handling middleware

### 4. **User Management** ✅
- ✅ `GET /user/profile` - Get logged-in user profile
- ✅ `PUT /user/profile` - Update user profile
- ✅ `GET /user/subscription` - Get subscription status

### 5. **Policy Management** ✅
- ✅ `POST /policies` - Create new policy
- ✅ `GET /policies` - Get all policies for logged-in user
- ✅ `GET /policies/:id` - Get single policy
- ✅ `PUT /policies/:id` - Update policy
- ✅ `DELETE /policies/:id` - Delete policy
- ✅ `POST /policy/policy/:policyId/document` - Upload policy document
- ✅ `GET /policy/policy/:policyId/document` - Get policy documents

### 6. **Nominee Management** ✅
- ✅ `POST /nominees` - Add new nominee
- ✅ `GET /nominees` - Get all nominees for logged-in user
- ✅ `GET /nominees/:id` - Get single nominee
- ✅ `PUT /nominees/:id` - Update nominee
- ✅ `DELETE /nominees/:id` - Delete nominee
- ✅ `POST /nominee/:id/document` - Upload nominee document

### 7. **Policy-Nominee Linking** ✅
- ✅ `POST /policy/:policyId/nominee` - Link nominee to policy with share %

### 8. **Insurance Companies** ✅
- ✅ `GET /admin/companies` - Get all companies (Admin)
- ✅ `POST /admin/companies` - Add new company (Admin)
- ✅ `GET /admin/companies/:id` - Get company by ID (Admin)
- ✅ `PUT /admin/companies/:id` - Update company (Admin)
- ✅ `DELETE /admin/companies/:id` - Delete company (Admin)

### 9. **Deceased Alerts** ✅
- ✅ `POST /alerts` - Create new alert
- ✅ `GET /alerts/:id` - Get specific alert
- ✅ `PATCH /alerts/:id/verify` - Verify alert (Admin)
- ✅ `GET /admin/alerts` - Get all alerts (Admin)
- ✅ `GET /admin/alerts/stats` - Get alert statistics (Admin)

### 10. **Admin Management** ✅
- ✅ `POST /admin/login` - Admin login
- ✅ `GET /admin/users` - Get all users
- ✅ `GET /admin/users/:id` - Get user by ID
- ✅ `PUT /admin/users/:id/status` - Update user status

### 11. **Document Management** ✅
- ✅ User document uploads
- ✅ Policy document uploads
- ✅ Nominee document uploads
- ✅ File upload middleware (multer)
- ✅ Static file serving (`/uploads`)

### 12. **Utilities & Middleware** ✅
- ✅ `authMiddleware.ts` - JWT verification
- ✅ `adminAuth.middleware.ts` - Admin JWT verification
- ✅ `validation.middleware.ts` - Request validation
- ✅ `rateLimiter.middleware.ts` - Rate limiting
- ✅ `requestLogger.middleware.ts` - Request logging
- ✅ `fileUpload.ts` - File upload utilities
- ✅ Error handling with custom error classes

---

## ❌ **Missing or Different from Documentation**

### 1. **Subscription Creation Endpoint** ✅
**Documentation says:**
- `POST /subscription` - Create new subscription (after payment)

**Current Implementation:**
- ✅ `POST /subscription` route with auth + validation (`subscription.routes.ts`)
- ✅ `createSubscription` service updates user status when payment succeeds
- ✅ Frontend `PaymentScreen` calls the new endpoint after simulated payment

### 2. **Endpoint Path Differences** ⚠️

| Documentation | Actual Implementation | Status |
|--------------|----------------------|--------|
| `GET /auth/profile` | `GET /user/profile` | ⚠️ Different path |
| `PUT /auth/update-profile` | `PUT /user/profile` | ⚠️ Different path |
| `GET /user/:id` | Not found | ❌ Missing |
| `PUT /user/:id` | Not found | ❌ Missing |
| `GET /user/:id/documents` | Different structure | ⚠️ Different path |
| `POST /user/:id/document` | Different structure | ⚠️ Different path |
| `GET /policies/:user_id` | `GET /policies` (gets current user's) | ⚠️ Different approach |
| `GET /policy/:id` | `GET /policies/:id` | ⚠️ Different path |
| `GET /nominee/:user_id` | `GET /nominees` (gets current user's) | ⚠️ Different approach |
| `GET /subscription/:user_id` | `GET /user/subscription` (gets current user's) | ⚠️ Different path |

### 3. **Admin Document Verification** ✅
**Documentation says:**
- `PATCH /admin/verify-document/:id` - Verify user/policy document

**Current Implementation:**
- ✅ Canonical route: `PATCH /admin/documents/verify-document/:id` with validation + role guard
- ✅ Compatibility alias added for `PATCH /admin/verify-document/:id`
- ✅ Admin portal `KycReview` page surfaces verification workflow for submitted docs

### 4. **Admin Policies Endpoint** ✅
**Documentation says:**
- `GET /admin/policies` - Get all policies

**Current Implementation:**
- ✅ `GET /admin/policies` route protected by admin auth + rate limiting
- ✅ Service returns policy, user, company, nominee, and document metadata with pagination
- ✅ Admin Policies page consumes the endpoint and lists uploaded policies

### 5. **JWT Expiry Time** ⚠️
**Documentation says:**
- JWT expiry: 24 hours

**Current Implementation:**
- ⚠️ **7 days** (in `src/utils/jwt.ts`)

### 6. **Environment Variables** ⚠️
**Documentation mentions:**
- `PORT=5000`

**Current Implementation:**
- Default `PORT=3000` (can be configured via `.env`)

---

## 🔧 **What Needs to Be Added**

### High Priority:
1. **Standardize Endpoint Paths**
   - ✅ Critical functionality exists; consider updating public docs to match canonical routes (`/user/profile`, `/subscription`, `/admin/documents/...`, etc.)
   - ➡️ Alternatively, maintain compatibility aliases where required (e.g., `/admin/verify-document/:id`)

2. **User by ID Endpoints**
   - ✅ `GET /user/:id` and `PUT /user/:id` implemented with validation and auth checks
   - 🔍 Confirm whether documentation should highlight admin-only variants (`/admin/users/:id`)

### Medium Priority:
3. **JWT Expiry Alignment**
   - ⚠️ Docs mention 24 hours; implementation uses 7 days. Decide which source of truth to follow.

4. **Environment Variables**
   - ⚠️ Docs default to `PORT=5000`; server defaults to `3000`. Update whichever is out-of-date.

---

## 📊 **Summary**

| Category | Status | Percentage |
|----------|--------|------------|
| **Core Architecture** | ✅ Complete | 100% |
| **Database Schema** | ✅ Complete | 100% |
| **Authentication** | ✅ Complete | 100% |
| **User Management** | ✅ Complete | 100% |
| **Policy Management** | ✅ Complete | 100% |
| **Nominee Management** | ✅ Complete | 100% |
| **Subscription Management** | ✅ Complete | 100% |
| **Insurance Companies** | ✅ Complete | 100% |
| **Deceased Alerts** | ✅ Complete | 100% |
| **Admin Management** | ✅ Complete | 100% |
| **Document Management** | ✅ Complete | 100% |
| **Utilities & Middleware** | ✅ Complete | 100% |

**Overall Implementation Status: ~95% Complete**

The backend is **very well implemented** and matches the documentation structure almost perfectly. The main missing piece is the **subscription creation endpoint** (`POST /subscription`), which is critical for handling payment callbacks.

---

## 🎯 **Recommendations**

1. **Document canonical vs legacy endpoint paths** so API consumers have a single source of truth.
2. **Clarify JWT expiry expectations** (docs vs implementation).
3. **Ensure environment configuration docs reference the active defaults** (e.g., `PORT`).

