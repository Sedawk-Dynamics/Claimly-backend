## Endpoint Reference (Detailed)

All endpoints return JSON following the envelope `{ "success": boolean, "data"?: any, "error"?: string, "message"?: string }` unless explicitly mentioned (e.g., file downloads). Use this file as the contract when wiring Postman requests, mobile screens, or admin flows.

### Shared Object Shapes

#### UserProfile
```json
{
  "id": "42",
  "name": "John Doe",
  "dob": "1990-01-15",
  "email": "john@example.com",
  "mobileNumber": "9876543210",
  "deviceId": "device-123",
  "subscriptionStatus": "ACTIVE",
  "referralCode": "ABC123",
  "walletBalance": 1250.5,
  "createdAt": "2024-01-01T10:00:00.000Z",
  "updatedAt": "2024-02-01T09:30:00.000Z"
}
```

#### SubscriptionSummary (list view)
```json
{
  "id": "301",
  "planName": "Annual Shield",
  "amount": "1499.00",
  "paymentId": "pay_Lxyz",
  "paymentStatus": "SUCCESS",
  "transactionDate": "2024-02-01T10:00:00.000Z",
  "expiresAt": "2024-03-02T10:00:00.000Z",
  "receiptUrl": "/uploads/receipts/receipt_301.pdf"
}
```

#### SubscriptionOverview (current status)
```json
{
  "status": "ACTIVE",
  "subscription": {
    "id": "301",
    "planName": "Annual Shield",
    "amount": "1499.00",
    "paymentId": "pay_Lxyz",
    "transactionDate": "2024-02-01T10:00:00.000Z",
    "expiresAt": "2024-03-02T10:00:00.000Z",
    "paymentStatus": "SUCCESS",
    "receiptUrl": "/uploads/receipts/receipt_301.pdf"
  }
}
```

#### KycStatus
```json
{
  "status": "PENDING",
  "hasAadhaar": true,
  "hasPan": false,
  "missingDocuments": ["PAN"],
  "documents": [
    {
      "id": "11",
      "documentType": "AADHAAR",
      "documentName": "Aadhaar Front",
      "documentUrl": "/uploads/users/11_front.png",
      "isVerified": true,
      "uploadedAt": "2024-01-10T09:00:00.000Z",
      "verifiedAt": "2024-01-12T09:00:00.000Z",
      "rejectedAt": null
    }
  ]
}
```

#### DocumentRecord (user/policy/nominee docs)
```json
{
  "id": "88",
  "documentType": "POLICY_COPY",
  "documentName": "LIC Policy Copy",
  "documentUrl": "/uploads/policies/lic_copy.pdf",
  "isVerified": false,
  "uploadedAt": "2024-02-05T08:00:00.000Z",
  "verifiedAt": null,
  "rejectedAt": null
}
```

#### PolicyRecord
```json
{
  "id": "501",
  "userId": "42",
  "insuranceCompanyId": "3",
  "policyNumber": "LIC-12345",
  "sumAssured": "1000000.00",
  "status": "PENDING",
  "uploadedAt": "2024-02-05T08:00:00.000Z"
}
```

#### NomineeRecord
```json
{
  "id": "701",
  "userId": "42",
  "name": "Jane Doe",
  "relationship": "SPOUSE",
  "mobileNumber": "9876501234",
  "dob": "1992-06-01",
  "email": "jane@example.com",
  "address": "Mumbai",
  "status": "PENDING",
  "createdAt": "2024-02-05T08:00:00.000Z",
  "updatedAt": "2024-02-06T08:00:00.000Z"
}
```

#### PolicyNomineeLink
```json
{
  "policyId": "501",
  "nomineeId": "701",
  "sharePercentage": "50.00",
  "createdAt": "2024-02-06T09:00:00.000Z"
}
```

#### InsuranceCompanyPublic
```json
{
  "id": "3",
  "name": "Life Insurance Corp",
  "contactEmail": "support@lic.example",
  "contactNumber": "+91-1234567890",
  "websiteUrl": "https://www.lic.example",
  "address": "Mumbai"
}
```

#### AlertRecord
```json
{
  "id": "9001",
  "userId": "42",
  "detectedVia": "SMS",
  "detectionDate": "2024-02-10T12:00:00.000Z",
  "verificationStatus": "PENDING",
  "remarks": null,
  "smsText": "...",
  "createdAt": "2024-02-10T12:00:00.000Z"
}
```

#### NotificationRecord
```json
{
  "id": "1201",
  "title": "KYC Approved",
  "message": "Your Aadhaar was verified",
  "is_read": false,
  "created_at": "2024-02-03T08:00:00.000Z",
  "admin_id": "2",
  "user_id": "42"
}
```

#### WalletBalance & WalletTransaction
```json
{
  "balance": 220.5,
  "currency": "INR"
}
```
```json
{
  "id": "4401",
  "transactionType": "REFERRAL_REWARD",
  "amount": 120.5,
  "description": "Referral reward for Jane",
  "createdAt": "2024-02-02T09:00:00.000Z",
  "relatedUserId": "99"
}
```

#### SubscriptionPlan
```json
{
  "id": "10",
  "name": "Annual Shield",
  "price": "1499.00",
  "features": [
    "Unlimited nominees",
    "Instant alerts"
  ],
  "isPopular": true,
  "status": "ACTIVE",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-02-01T00:00:00.000Z"
}
```

#### SubscriptionRecord
```json
{
  "id": "301",
  "userId": "42",
  "planName": "Annual Shield",
  "amount": "1499.00",
  "paymentId": "pay_Lxyz",
  "paymentStatus": "SUCCESS",
  "transactionDate": "2024-02-01T10:00:00.000Z",
  "expiresAt": "2024-03-02T10:00:00.000Z",
  "walletAmountUsed": "200.00",
  "receiptUrl": "/uploads/receipts/receipt_301.pdf"
}
```

#### AdminActionRecord
```json
{
  "id": "801",
  "admin": {
    "id": "2",
    "name": "Ops Lead",
    "email": "ops@claimly.com",
    "role": "STAFF"
  },
  "user": {
    "id": "42",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "actionType": "DOCUMENT_APPROVED",
  "notes": "Verified Aadhaar",
  "createdAt": "2024-02-04T07:30:00.000Z"
}
```

### Health & Diagnostics

- **GET /health** – No headers/body. Use to verify API & DB connectivity. Returns `{ status: 'OK'|'ERROR', message, database, timestamp, environment }`. Errors: 503 when DB fails.
- **GET /diagnostics/uploads** – No auth. Inspects uploads directory structure for debugging; output lists directories, file counts, and sample filenames.
- **GET /uploads/:type/:filename** – Serves stored documents (`type ∈ users|policies|nominees`). Returns PDF/PNG binary. Errors: 400 invalid type/name, 404 missing file.

### Authentication (User & Test)

- **POST /auth/register** – Headers: `Content-Type: application/json`. Body: `{ idToken, mobileNumber, name?, email?, deviceId?, referralCode? }`. Validates Firebase OTP, upserts user, returns `{ token, user: UserProfile }`. Errors: 400 invalid OTP/data, 404 user missing (login before signup).
- **POST /test-auth/login** – Dev-only helper, no Firebase needed. Body: `{ mobileNumber, name, email? }`. Returns `{ token, user: UserProfile }`. Automatically stores `authToken` env variable via Postman test script.
- **POST /test-auth/exchange-token** – Body: `{ customToken }` from Firebase Admin. Returns `{ idToken, refreshToken, expiresIn }` for local testing.

### Admin Authentication

- **POST /admin/login** – Body `{ email, password }`. Returns `{ token, admin: { id, name, role } }`. Store token as `adminToken` for admin endpoints. Errors: 401 invalid credentials, 429 rate limit.

### User Management

- **GET /user/profile** – Header `Authorization`. Response: `UserProfile`.
- **PUT /user/profile** – Header required. Body `{ name?, dob?, email?, deviceId? }`. Response: updated `UserProfile`. Errors: 409 duplicate email.
- **GET /user/subscription** – Header required. Query `all=true` for history. When `all=true`, response is `SubscriptionSummary[]`; otherwise `SubscriptionOverview`.
- **GET /user/kyc-status** – Header required. Response: `KycStatus`.
- **POST /user/referral-code** – Header required. Response `{ referralCode }` (existing or new).
- **POST /user/fcm-token** – Header required. Body `{ token }`. Response `{ message: 'FCM token registered successfully' }`.
- **DELETE /user/fcm-token** – Header required. Response `{ message: 'FCM token unregistered successfully' }`.
- **GET /user/:id** – Header required. Path param `id`. Response: `UserProfile`.
- **PUT /user/:id** – Header required. Body same as profile update. Response: updated `UserProfile`.

### User Documents (`/user/document`)

- **POST /user/document** – Header `Authorization`. Multipart (`file`, `documentType ∈ AADHAAR|PAN|OTHER`, `documentName`). Response: `DocumentRecord`.
- **GET /user/document** – Header required. Response: `DocumentRecord[]`.
- **GET /user/document/:id** – Header required. Response: `DocumentRecord`.
- **PUT /user/document/:id** – Header + multipart (file optional). Response: `DocumentRecord`.
- **DELETE /user/document/:id** – Response `{ message: 'Document deleted successfully' }`.

### Policy Management (`/policies`)

- **POST /policies** – Body `{ insuranceCompanyId, policyNumber?, sumAssured? }`. When `policyNumber` or `sumAssured` is missing/blank the record remains `DRAFT`; once all required fields are provided the status auto-advances to `PENDING`.
- **GET /policies** – Header required. Response: `PolicyRecord[]`.
- **GET /policies/:id** – Header required. Response: `PolicyRecord` including insurer & docs.
- **PUT /policies/:id** – Header required. Body `{ insuranceCompanyId?, policyNumber?, sumAssured?, status? }`. Include `status: 'DRAFT'` to revert a submission for edits; otherwise omit and the backend will recalculate the appropriate status after updating.
- **DELETE /policies/:id** – Header required. Response `{ message: 'Policy deleted successfully' }`.

### Nominee Management (`/nominees`)

- **POST /nominees** – Header required. Body `{ name, relationship?, mobileNumber?, dob?, email?, address? }`. Missing contact/KYC fields keep the nominee in `DRAFT`; filling everything and uploading documents moves it to `PENDING`.
- **GET /nominees** – Header required. Response: `NomineeRecord[]`.
- **GET /nominees/:id** – Header required. Response: `NomineeRecord`.
- **PUT /nominees/:id** – Header required. Body same as create plus optional `status: 'DRAFT'` to force the record back into draft state. Response: updated `NomineeRecord`.
- **DELETE /nominees/:id** – Header required. Response `{ message: 'Nominee deleted successfully' }`.

### Nominee Documents (`/nominee/:nomineeId/document`)

- **POST /nominee/:nomineeId/document** – Header required. Multipart (types: `NOMINEE_ID|ADDRESS_PROOF|OTHER`). Response: `DocumentRecord`.
- **GET /nominee/:nomineeId/document** – Header required. Response: `DocumentRecord[]`.
- **GET /nominee/:nomineeId/document/:documentId** – Header required. Response: `DocumentRecord`.
- **PUT /nominee/:nomineeId/document/:documentId** – Header required. Response: updated `DocumentRecord`.
- **DELETE /nominee/:nomineeId/document/:documentId** – Response `{ message: 'Document deleted successfully' }`.

### Policy Nominee Linking (`/policy`)

- **GET /policy/:policyId** – Header required. Response `{ policy: PolicyRecord, nominees: PolicyNomineeLink[] }`.
- **POST /policy/:policyId/nominee** – Body `{ nomineeId, sharePercentage }`. Response: `PolicyNomineeLink`.
- **PUT /policy/:policyId/nominee/:nomineeId** – Body `{ sharePercentage }`. Response: `PolicyNomineeLink`.
- **DELETE /policy/:policyId/nominee/:nomineeId** – Response `{ message: 'Nominee unlinked' }`.

### Policy Documents (`/policy/:policyId/document`)

- **POST /policy/:policyId/document** – Multipart upload (types: `POLICY_COPY|RECEIPT|OTHER`). Response: `DocumentRecord`.
- **GET /policy/:policyId/document** – Response: `DocumentRecord[]`.
- **GET /policy/:policyId/document/:documentId** – Response: `DocumentRecord`.
- **PUT /policy/:policyId/document/:documentId** – Response: updated `DocumentRecord`.
- **DELETE /policy/:policyId/document/:documentId** – Response `{ message: 'Document deleted successfully' }`.

### Companies

- **GET /companies** – Public endpoint. Response: `InsuranceCompanyPublic[]` sorted by name; use when listing insurers on the client.

### Alerts (User-Facing)

- **POST /alerts** – Header `Authorization`. Body `{ smsText, detectionDate? }`. Creates a deceased-alert candidate linked to the logged-in user. Response: `AlertRecord` with `verificationStatus: 'PENDING'`.
- **GET /alerts/:id** – No auth required so admins/mobile clients can poll. Response: `AlertRecord`.
- **PATCH /alerts/:id/verify** – Admin token required. Body `{ verificationStatus: 'VERIFIED'|'FALSE_ALERT', remarks? }`. Response: updated `AlertRecord`.

### Notifications

- **POST /admin/notifications** – Admin token required. Body `{ user_id, title, message }`. Creates notification + triggers push. Response: `NotificationRecord`.
- **GET /notifications** – User token required. Response: `NotificationRecord[]` newest first.
- **PATCH /notifications/:id/read** – User token required. Marks notification as read. Response `{ success: true }`.
- **DELETE /notifications/:id** – User token required. Response `{ message: 'Notification deleted successfully' }`.

### Wallet

- **GET /wallet/balance** – Header required. Response: `WalletBalance`.
- **GET /wallet/transactions** – Header required. Response: `WalletTransaction[]` (max 50, newest first).
- **GET /wallet/eligibility** – Header required. Response `{ isEligible, currentBalance, minimumRequired? }`.

### Subscription & Payments

- **POST /payment/create-order** – Header required. **Razorpay (Android/Web).** Body `{ amount (number, rupees), currency?='INR', receipt?, notes? }`. Response `{ id, amount, currency, receipt, status, key_id }` (amount in paise).
- **POST /payment/verify** – Header required. **Razorpay (Android/Web).** Body `{ razorpay_order_id, razorpay_payment_id, razorpay_signature, planName, amount, walletAmountUsed? }`. Response `{ success: true, subscription: SubscriptionRecord, paymentStatus }`.
- **POST /payment/apple-verify** – Header required. **Apple In-App Purchase (iOS).** Body `{ receiptData (base64), planName, productId, transactionId?, walletAmountUsed? }`. Verifies receipt with Apple, creates subscription. Wallet, referral, and discount work the same as Razorpay. Response `{ success: true, subscription: SubscriptionRecord, paymentStatus, alreadyProcessed? }`.

  **iOS flow (same concepts as Razorpay):** 1) Fetch plans: GET /subscription-plan/active. 2) Check wallet: GET /wallet/balance. 3) User selects plan; optionally use wallet → `finalAmount = planPrice - walletAmount`. 4) Complete purchase via StoreKit; get base64 receipt and `transaction_id`. 5) Call **POST /payment/apple-verify** with `receiptData`, `planName`, `productId` (Apple product ID), `transactionId`, `walletAmountUsed` if any. Backend validates receipt with Apple, then creates subscription (wallet deduction, referral rewards, receipt PDF) as with Razorpay.
- **POST /subscription** – Legacy direct creation. Body matches `createSubscriptionSchema`. Response: `SubscriptionRecord`.
- **GET /subscription/:id/receipt** – Header required. Streams PDF receipt. Errors: 404 if absent or different owner.
- **GET /subscription/:id/receipt-url** – Header required. Response `{ receiptUrl, downloadUrl }`.

### Subscription Plans

- **GET /subscription-plan/active** – Header required. Response: `SubscriptionPlan[]` filtered to `status === 'ACTIVE'`.
- **GET /subscription-plan/admin** – Admin token required. Response: paginated list of all plans (active/inactive/draft).
- **GET /subscription-plan/admin/:id** – Admin token required. Response: single `SubscriptionPlan`.
- **POST /subscription-plan/admin** – Admin token required. Body `{ name, price, features (string[]), isPopular?, status? }`. Response: created plan.
- **PUT /subscription-plan/admin/:id** – Admin token required. Body allows partial updates. Response: updated plan.
- **DELETE /subscription-plan/admin/:id** – Admin token required. Response `{ message: 'Plan archived' }`.

### Admin Alerts (`/admin/alerts`)

- **GET /admin/alerts/stats** – Admin token. Returns aggregates like `{ pendingCount, verifiedCount, falseAlertCount }`.
- **GET /admin/alerts** – Admin token. Query `page`, `limit`, `status`, `search`. Response `{ alerts: AlertRecord[], pagination }`.
- **GET /admin/alerts/:id** – Admin token. Response: `AlertRecord`.
- **PUT /admin/alerts/:id/verify** – Admin token. Body `{ verificationStatus, remarks? }`. Response: updated record.
- **POST /admin/alerts/bulk-verify** – Admin token. Body `{ ids: string[], verificationStatus, remarks? }`. Response `{ updatedCount }`.

### Admin Users (`/admin/users`)

- **GET /admin/users** – Admin token. Query `page`, `limit`, `search`. Response `{ users: UserProfile[] + stats, pagination }`.
- **GET /admin/users/:id** – Admin token. Response: deep dive profile including policies, nominees, subscriptions, documents, alerts.
- **GET /admin/users/:id/activity-logs** – Admin token. Response: `UserActivityLog[]`.
- **PUT /admin/users/:id/status** – Admin token. Body `{ subscriptionStatus: 'ACTIVE'|'INACTIVE'|'EXPIRED' }`. Response `{ id, name, email, subscriptionStatus, updatedAt }`.

### Admin Actions (`/admin/actions`)

- **POST /admin/actions** – Admin token. Body `{ userId, actionType, notes? }`. Response: `AdminActionRecord`.
- **GET /admin/actions** – Admin token. Query `page`, `limit`, `adminId`, `userId`, `actionType`. Response `{ actions: AdminActionRecord[], pagination }`.
- **GET /admin/actions/:id** – Admin token. Response: `AdminActionRecord` plus summary counts.

### Admin Companies (`/admin/companies`)

- **POST /admin/companies** – Admin token. Body `{ name, contactEmail?, contactNumber?, websiteUrl?, address? }`. Response: created company entry.
- **GET /admin/companies** – Admin token. Response: company list with pagination.
- **GET /admin/companies/:id** – Admin token. Response: single company detail.
- **PUT /admin/companies/:id** – Admin token. Body partial fields. Response: updated record.
- **DELETE /admin/companies/:id** – Admin token. Response `{ message: 'Company deleted successfully' }`.

### Admin Policies (`/admin/policies`)

- **GET /admin/policies** – Admin token. Query filters supported. Response `{ policies: PolicyRecord[], pagination }`.
- **POST /admin/policies/:id/accept** – Admin token. Marks policy as accepted. Response: updated `PolicyRecord`.
- **POST /admin/policies/:id/reject** – Admin token. Optional body `{ reason }`. Response: updated `PolicyRecord`.

### Admin Documents (`/admin/documents`)

- **GET /admin/documents** – Admin token. Defaults to pending KYC docs. Response `{ documents: DocumentRecord[], pagination }`.
- **GET /admin/documents/kyc-documents** – Admin token. Returns user KYC uploads.
- **GET /admin/documents/policy-documents** – Admin token. Returns policy documents.
- **GET /admin/documents/nominee-documents** – Admin token. Returns nominee documents.
- **PATCH /admin/documents/verify-document/:id** – Admin token. Body `{ documentType: 'user'|'policy'|'nominee' }`. Response: updated `DocumentRecord`.
- **PATCH /admin/documents/reject-document/:id** – Admin token. Same body. Marks doc rejected.
- **POST /admin/documents/accept-entity/:id** – Admin token. Body `{ entityType: 'user'|'policy'|'nominee' }`. Response `{ message: 'Entity accepted' }`.
- **POST /admin/documents/reject-entity/:id** – Admin token. Body `{ entityType, reason? }`. Response `{ message: 'Entity rejected' }`.

### Admin Document Compatibility Routes (`/admin`)

- **GET /admin/kyc-documents** – Same response as `/admin/documents/kyc-documents`.
- **PATCH /admin/verify-document/:id** – Same contract as `/admin/documents/verify-document/:id`.

Use this reference to keep the Postman collection descriptions, request samples, and test scripts in sync with the backend implementation. When adding new routes, follow the same structure (purpose → headers → body → response shape) so app developers always have a single, consistent contract.


