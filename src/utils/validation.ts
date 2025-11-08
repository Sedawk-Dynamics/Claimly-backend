import { z } from 'zod';

// Auth validation schemas
export const verifyOTPSchema = z.object({
  body: z.object({
    idToken: z.string().min(1, 'idToken is required'),
    mobileNumber: z.string().regex(/^[0-9]{10}$/, 'Invalid mobile number format'),
    name: z.string().optional(),
    dob: z.string().optional(),
    deviceId: z.string().optional(),
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
    policyNumber: z.string().min(1, 'policyNumber is required'),
    sumAssured: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: 'sumAssured must be a positive number',
    }),
  }),
});

export const updatePolicySchema = z.object({
  body: z.object({
    insuranceCompanyId: z.string().optional(),
    policyNumber: z.string().optional(),
    sumAssured: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  }),
  params: z.object({
    id: z.string().min(1, 'Policy ID is required'),
  }),
});

// Nominee validation schemas
export const createNomineeSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    relationship: z.enum(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'FRIEND', 'OTHER']),
    mobileNumber: z.string().regex(/^[0-9]{10}$/, 'Invalid mobile number format'),
    email: z.string().email().nullable().optional(),
    address: z.string().nullable().optional(),
  }),
});

export const updateNomineeSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    relationship: z.enum(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'FRIEND', 'OTHER']).optional(),
    mobileNumber: z.string().regex(/^[0-9]{10}$/).optional(),
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
    userId: z.string().min(1, 'userId is required'),
    detectedVia: z.enum(['SMS', 'MANUAL']),
    detectionDate: z.string().datetime().optional(),
    remarks: z.string().optional(),
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
  }),
});

// Document validation schemas
export const uploadDocumentSchema = z.object({
  body: z.object({
    documentType: z.enum(['AADHAAR', 'PAN', 'OTHER']).or(z.enum(['POLICY_COPY', 'RECEIPT', 'OTHER'])).or(z.enum(['NOMINEE_ID', 'ADDRESS_PROOF', 'DEATH_CERTIFICATE', 'OTHER'])),
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

// Validation middleware
import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }));
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors,
        });
        return;
      }
      next(error);
    }
  };
};

