import { z } from 'zod';

// Helper function to normalize phone numbers
function normalizePhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  
  // Take the last 10 digits (handles country codes like +91)
  if (digitsOnly.length >= 10) {
    return digitsOnly.slice(-10);
  }
  
  // If less than 10 digits, return as is (will be caught by validation)
  return digitsOnly;
}

// Auth validation schemas
export const verifyOTPSchema = z.object({
  body: z.object({
    idToken: z.string().min(1, 'idToken is required'),
    mobileNumber: z.string()
      .transform((val) => normalizePhoneNumber(val))
      .pipe(z.string().regex(/^[0-9]{10}$/, 'Invalid mobile number format. Must be 10 digits.')),
    name: z.string().optional(),
    email: z.preprocess(
      (val) => {
        if (val === '' || val === null || val === undefined) {
          return null;
        }
        return typeof val === 'string' ? val.trim() : null;
      },
      z.string().email('Invalid email format').nullable().optional()
    ),
    deviceId: z.string().optional(),
    referralCode: z.string().optional(),
  }),
});

export const adminLoginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

// User validation schemas
export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
    email: z.string().email().nullable().optional(),
    deviceId: z.string().nullable().optional(),
  }),
});

export const getUserByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'User ID is required'),
  }),
});

export const updateUserByIdSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
    email: z.string().email().nullable().optional(),
    deviceId: z.string().nullable().optional(),
  }),
  params: z.object({
    id: z.string().min(1, 'User ID is required'),
  }),
});

// Policy validation schemas
export const createPolicySchema = z.object({
  body: z.object({
    insuranceCompanyId: z.string().min(1, 'insuranceCompanyId is required'),
    policyNumber: z.string().optional(),
    sumAssured: z.string()
      .optional()
      .refine(
        (val) => val === undefined || (!isNaN(parseFloat(val)) && parseFloat(val) > 0),
        {
          message: 'sumAssured must be a positive number',
        }
      ),
  }),
});

// Policy draft schema is lenient so users can save progress mid-way.
export const createPolicyDraftSchema = z.object({
  body: z.object({
    insuranceCompanyId: z.string().min(1, 'insuranceCompanyId is required'),
    policyNumber: z.string().optional(),
    sumAssured: z
      .string()
      .optional()
      .refine(
        (val) => val === undefined || val === '' || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
        { message: 'sumAssured must be zero or a positive number' }
      ),
  }),
});

export const updatePolicySchema = z.object({
  body: z.object({
    insuranceCompanyId: z.string().optional(),
    policyNumber: z.string().optional(),
    sumAssured: z.string().optional(),
    status: z.enum(['DRAFT', 'PENDING', 'ACCEPTED', 'REJECTED']).optional(),
  }),
  params: z.object({
    id: z.string().min(1, 'Policy ID is required'),
  }),
});

// Nominee validation schemas
export const createNomineeSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    relationship: z.enum(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'FRIEND', 'OTHER']).optional(),
    mobileNumber: z.string()
      .optional()
      .transform((val) => (val === undefined ? undefined : normalizePhoneNumber(val)))
      .refine(
        (val) => val === undefined || /^[0-9]{10}$/.test(val),
        'Invalid mobile number format. Must be 10 digits.'
      ),
    dob: z.string()
      .optional()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format'),
    email: z.preprocess(
      (val) => {
        if (val === '' || val === null || val === undefined) {
          return null;
        }
        return typeof val === 'string' ? val.trim() : null;
      },
      z.string().email('Invalid email address').nullable().optional()
    ),
    address: z.string().nullable().optional(),
  }),
});

// Allow users to park a nominee with partial details as a draft.
export const createNomineeDraftSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    relationship: z.enum(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'FRIEND', 'OTHER']).optional(),
    mobileNumber: z
      .string()
      .optional()
      .transform((val) => (val === undefined ? undefined : normalizePhoneNumber(val)))
      .refine(
        (val) => val === undefined || val === '' || /^[0-9]{10}$/.test(val),
        'Invalid mobile number format. Must be 10 digits.'
      ),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format').optional(),
    email: z.preprocess(
      (val) => {
        if (val === '' || val === null || val === undefined) {
          return null;
        }
        return typeof val === 'string' ? val.trim() : null;
      },
      z.string().email('Invalid email address').nullable().optional()
    ),
    address: z.string().nullable().optional(),
  }),
});

export const updateNomineeSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    relationship: z.enum(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'FRIEND', 'OTHER']).optional(),
    mobileNumber: z.string().regex(/^[0-9]{10}$/).optional(),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    email: z.string().email().nullable().optional(),
    address: z.string().nullable().optional(),
  }),
  params: z.object({
    id: z.string().min(1, 'Nominee ID is required'),
  }),
});

// Policy-Nominee validation schemas
export const linkNomineeSchema = z.object({
  body: z.object({
    nomineeId: z.string().min(1, 'nomineeId is required'),
    sharePercentage: z.string().refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0 && num <= 100;
      },
      { message: 'sharePercentage must be between 0 and 100' }
    ),
  }),
  params: z.object({
    policyId: z.string().min(1, 'Policy ID is required'),
  }),
});

export const updateNomineeShareSchema = z.object({
  body: z.object({
    sharePercentage: z.string().refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0 && num <= 100;
      },
      { message: 'sharePercentage must be between 0 and 100' }
    ),
  }),
  params: z.object({
    policyId: z.string().min(1, 'Policy ID is required'),
    nomineeId: z.string().min(1, 'Nominee ID is required'),
  }),
});

// Alert validation schemas
export const createAlertSchema = z.object({
  body: z.object({
    smsText: z.string().min(1, 'SMS text is required'),
    detectionDate: z.string().datetime().optional(),
  }),
});

export const verifyAlertSchema = z.object({
  body: z.object({
    verificationStatus: z.enum(['VERIFIED', 'FALSE_ALERT']),
    remarks: z.string().optional(),
  }),
  params: z.object({
    id: z.string().min(1, 'Alert ID is required'),
  }),
});

// Payment validation schemas
export const createPaymentOrderSchema = z.object({
  body: z.object({
    amount: z.number().positive('Amount must be a positive number'),
    currency: z.string().optional().default('INR'),
    receipt: z.string().optional(),
    notes: z.record(z.string(), z.string()).optional(),
  }),
});

export const verifyPaymentSchema = z.object({
  body: z.object({
    razorpay_order_id: z.string().min(1, 'razorpay_order_id is required'),
    razorpay_payment_id: z.string().min(1, 'razorpay_payment_id is required'),
    razorpay_signature: z.string().min(1, 'razorpay_signature is required'),
    planName: z.string().min(1, 'planName is required'),
    amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: 'amount must be a positive number',
    }),
    walletAmountUsed: z.string().optional(),
  }),
});

// Subscription validation schemas
export const createSubscriptionSchema = z.object({
  body: z.object({
    planName: z.string().min(1, 'planName is required'),
    amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: 'amount must be a positive number',
    }),
    paymentId: z.string().min(1, 'paymentId is required'),
    paymentStatus: z.enum(['SUCCESS', 'PENDING', 'FAILED']).optional(),
    transactionDate: z.string().datetime().optional(),
    walletAmountUsed: z.union([
      z.string().refine((val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= 0;
      }, { message: 'walletAmountUsed must be a non-negative number' }),
      z.number().nonnegative(),
    ]).optional(),
  }),
});

// Document validation schemas
export const uploadDocumentSchema = z.object({
  body: z.object({
    documentType: z.enum(['AADHAAR', 'PAN', 'OTHER']).or(z.enum(['POLICY_COPY', 'RECEIPT', 'OTHER'])).or(z.enum(['NOMINEE_ID', 'ADDRESS_PROOF', 'OTHER'])),
    documentName: z.string().min(1, 'documentName is required'),
  }),
});

// Company validation schemas
export const createCompanySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Company name is required'),
    contactEmail: z.string().email().nullable().optional(),
    contactNumber: z.string().nullable().optional(),
    websiteUrl: z.string().url().nullable().optional(),
    address: z.string().nullable().optional(),
  }),
});

// Admin document verification schema
export const verifyDocumentSchema = z.object({
  body: z.object({
    documentType: z.enum(['user', 'policy', 'nominee']),
  }),
  params: z.object({
    id: z.string().min(1, 'Document ID is required'),
  }),
});

// Admin document rejection schema (same as verification schema)
export const rejectDocumentSchema = z.object({
  body: z.object({
    documentType: z.enum(['user', 'policy', 'nominee']),
  }),
  params: z.object({
    id: z.string().min(1, 'Document ID is required'),
  }),
});

// Validation middleware
import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      }) as { body?: any; query?: any; params?: any };
      // Update request with validated and transformed values
      if (validated.body) req.body = validated.body;
      if (validated.query) req.query = validated.query;
      if (validated.params) req.params = validated.params;
      next();
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }));
        // Log validation errors for debugging
        console.error('Validation error:', {
          path: req.path,
          method: req.method,
          errors,
          body: req.body,
        });
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors,
        });
        return;
      }
      // Log unexpected errors for debugging
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('Validation middleware unexpected error:', {
        message: errorMessage,
        stack: errorStack,
        path: req.path,
        method: req.method,
      });
      next(error);
    }
  };
};

