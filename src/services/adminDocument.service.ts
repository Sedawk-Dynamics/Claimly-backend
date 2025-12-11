import prisma from '../config/prismaClient';
import { NotFoundError } from '../utils/errors';
import logger from '../config/logger';
import type { UserDocumentType } from '@prisma/client';

export const verifyUserDocument = async (documentId: string, adminId: string) => {
  const document = await prisma.userDocument.findUnique({
    where: { id: BigInt(documentId) },
    include: { user: true },
  });

  if (!document) {
    throw new NotFoundError('User document not found');
  }

  const updatedDocument = await prisma.userDocument.update({
    where: { id: BigInt(documentId) },
    data: {
      is_verified: true,
      verified_at: new Date(),
      rejected_at: null, // Clear rejection when verifying
    },
  });

  logger.info('User document verified', {
    documentId,
    adminId,
    userId: document.user_id.toString(),
  });

  return {
    id: updatedDocument.id.toString(),
    userId: updatedDocument.user_id.toString(),
    documentType: updatedDocument.document_type,
    documentName: updatedDocument.document_name,
    documentUrl: updatedDocument.document_url,
    isVerified: updatedDocument.is_verified,
    uploadedAt: updatedDocument.uploaded_at,
    verifiedAt: updatedDocument.verified_at,
    rejectedAt: updatedDocument.rejected_at,
  };
};

export const verifyPolicyDocument = async (documentId: string, adminId: string) => {
  const document = await prisma.policyDocument.findUnique({
    where: { id: BigInt(documentId) },
    include: { 
      policy: {
        include: {
          documents: true,
        },
      },
    },
  });

  if (!document) {
    throw new NotFoundError('Policy document not found');
  }

  const updatedDocument = await prisma.policyDocument.update({
    where: { id: BigInt(documentId) },
    data: {
      is_verified: true,
      verified_at: new Date(),
      rejected_at: null, // Clear rejection when verifying
    },
  });

  // Check if all policy documents are now verified
  const policy = await prisma.policy.findUnique({
    where: { id: document.policy_id },
    include: {
      documents: true,
    },
  });

  if (policy) {
    const totalDocuments = policy.documents.length;
    const verifiedDocuments = policy.documents.filter((doc) => doc.is_verified).length;

    // If all documents are verified and policy is in DRAFT status, update to ACTIVE
    if (totalDocuments > 0 && verifiedDocuments === totalDocuments && policy.status === 'DRAFT') {
      await prisma.policy.update({
        where: { id: document.policy_id },
        data: {
          status: 'ACTIVE',
        },
      });

      logger.info('Policy status updated to ACTIVE after all documents verified', {
        policyId: document.policy_id.toString(),
        adminId,
        totalDocuments,
        verifiedDocuments,
      });
    }
  }

  logger.info('Policy document verified', {
    documentId,
    adminId,
    policyId: document.policy_id.toString(),
  });

  return {
    id: updatedDocument.id.toString(),
    policyId: updatedDocument.policy_id.toString(),
    documentType: updatedDocument.document_type,
    documentName: updatedDocument.document_name,
    documentUrl: updatedDocument.document_url,
    isVerified: updatedDocument.is_verified,
    uploadedAt: updatedDocument.uploaded_at,
    verifiedAt: updatedDocument.verified_at,
    rejectedAt: updatedDocument.rejected_at,
  };
};

export const verifyNomineeDocument = async (documentId: string, adminId: string) => {
  const document = await prisma.nomineeDocument.findUnique({
    where: { id: BigInt(documentId) },
    include: { nominee: true },
  });

  if (!document) {
    throw new NotFoundError('Nominee document not found');
  }

  const updatedDocument = await prisma.nomineeDocument.update({
    where: { id: BigInt(documentId) },
    data: {
      is_verified: true,
      verified_at: new Date(),
    },
  });

  logger.info('Nominee document verified', {
    documentId,
    adminId,
    nomineeId: document.nominee_id.toString(),
  });

  return {
    id: updatedDocument.id.toString(),
    nomineeId: updatedDocument.nominee_id.toString(),
    documentType: updatedDocument.document_type,
    documentName: updatedDocument.document_name,
    documentUrl: updatedDocument.document_url,
    isVerified: updatedDocument.is_verified,
    uploadedAt: updatedDocument.uploaded_at,
    verifiedAt: updatedDocument.verified_at,
  };
};

export const rejectUserDocument = async (documentId: string, adminId: string) => {
  const document = await prisma.userDocument.findUnique({
    where: { id: BigInt(documentId) },
    include: { user: true },
  });

  if (!document) {
    throw new NotFoundError('User document not found');
  }

  const updatedDocument = await prisma.userDocument.update({
    where: { id: BigInt(documentId) },
    data: {
      is_verified: false,
      verified_at: null,
      rejected_at: new Date(), // Mark as explicitly rejected
    },
  });

  logger.info('User document rejected', {
    documentId,
    adminId,
    userId: document.user_id.toString(),
  });

  return {
    id: updatedDocument.id.toString(),
    userId: updatedDocument.user_id.toString(),
    documentType: updatedDocument.document_type,
    documentName: updatedDocument.document_name,
    documentUrl: updatedDocument.document_url,
    isVerified: updatedDocument.is_verified,
    uploadedAt: updatedDocument.uploaded_at,
    verifiedAt: updatedDocument.verified_at,
    rejectedAt: updatedDocument.rejected_at,
  };
};

export const rejectPolicyDocument = async (documentId: string, adminId: string) => {
  const document = await prisma.policyDocument.findUnique({
    where: { id: BigInt(documentId) },
    include: { policy: true },
  });

  if (!document) {
    throw new NotFoundError('Policy document not found');
  }

  const updatedDocument = await prisma.policyDocument.update({
    where: { id: BigInt(documentId) },
    data: {
      is_verified: false,
      verified_at: null,
      rejected_at: new Date(), // Mark as explicitly rejected
    },
  });

  logger.info('Policy document rejected', {
    documentId,
    adminId,
    policyId: document.policy_id.toString(),
  });

  return {
    id: updatedDocument.id.toString(),
    policyId: updatedDocument.policy_id.toString(),
    documentType: updatedDocument.document_type,
    documentName: updatedDocument.document_name,
    documentUrl: updatedDocument.document_url,
    isVerified: updatedDocument.is_verified,
    uploadedAt: updatedDocument.uploaded_at,
    verifiedAt: updatedDocument.verified_at,
    rejectedAt: updatedDocument.rejected_at,
  };
};

export const rejectNomineeDocument = async (documentId: string, adminId: string) => {
  const document = await prisma.nomineeDocument.findUnique({
    where: { id: BigInt(documentId) },
    include: { nominee: true },
  });

  if (!document) {
    throw new NotFoundError('Nominee document not found');
  }

  const updatedDocument = await prisma.nomineeDocument.update({
    where: { id: BigInt(documentId) },
    data: {
      is_verified: false,
      verified_at: null,
    },
  });

  logger.info('Nominee document rejected/unverified', {
    documentId,
    adminId,
    nomineeId: document.nominee_id.toString(),
  });

  return {
    id: updatedDocument.id.toString(),
    nomineeId: updatedDocument.nominee_id.toString(),
    documentType: updatedDocument.document_type,
    documentName: updatedDocument.document_name,
    documentUrl: updatedDocument.document_url,
    isVerified: updatedDocument.is_verified,
    uploadedAt: updatedDocument.uploaded_at,
    verifiedAt: updatedDocument.verified_at,
  };
};

// Entity-level accept/reject functions (when no documents exist)
export const acceptUserWithoutDocuments = async (userId: string, adminId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // For KYC, we can't really accept without AADHAAR and PAN documents
  // This function creates placeholder accepted documents
  const existingDocs = await prisma.userDocument.findMany({
    where: {
      user_id: BigInt(userId),
      document_type: { in: ['AADHAAR', 'PAN'] },
    },
  });

  const hasAadhaar = existingDocs.some(doc => doc.document_type === 'AADHAAR');
  const hasPan = existingDocs.some(doc => doc.document_type === 'PAN');

  const results = [];

  if (!hasAadhaar) {
    const doc = await prisma.userDocument.create({
      data: {
        user_id: BigInt(userId),
        document_type: 'AADHAAR',
        document_name: 'Admin Accepted - No Document Uploaded',
        document_url: '', // Empty URL for placeholder
        is_verified: true,
        verified_at: new Date(),
      },
    });
    results.push(doc);
  }

  if (!hasPan) {
    const doc = await prisma.userDocument.create({
      data: {
        user_id: BigInt(userId),
        document_type: 'PAN',
        document_name: 'Admin Accepted - No Document Uploaded',
        document_url: '', // Empty URL for placeholder
        is_verified: true,
        verified_at: new Date(),
      },
    });
    results.push(doc);
  }

  logger.info('User accepted without documents', {
    userId,
    adminId,
    documentsCreated: results.length,
  });

  return {
    userId,
    documentsCreated: results.map(doc => ({
      id: doc.id.toString(),
      documentType: doc.document_type,
      documentName: doc.document_name,
      isVerified: doc.is_verified,
      verifiedAt: doc.verified_at,
    })),
  };
};

export const rejectUserWithoutDocuments = async (userId: string, adminId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Create placeholder rejected documents for missing required documents
  const existingDocs = await prisma.userDocument.findMany({
    where: {
      user_id: BigInt(userId),
      document_type: { in: ['AADHAAR', 'PAN'] },
    },
  });

  const hasAadhaar = existingDocs.some(doc => doc.document_type === 'AADHAAR');
  const hasPan = existingDocs.some(doc => doc.document_type === 'PAN');

  const results = [];

  if (!hasAadhaar) {
    const doc = await prisma.userDocument.create({
      data: {
        user_id: BigInt(userId),
        document_type: 'AADHAAR',
        document_name: 'Admin Rejected - No Document Uploaded',
        document_url: '', // Empty URL for placeholder
        is_verified: false,
        rejected_at: new Date(),
      },
    });
    results.push(doc);
  }

  if (!hasPan) {
    const doc = await prisma.userDocument.create({
      data: {
        user_id: BigInt(userId),
        document_type: 'PAN',
        document_name: 'Admin Rejected - No Document Uploaded',
        document_url: '', // Empty URL for placeholder
        is_verified: false,
        rejected_at: new Date(),
      },
    });
    results.push(doc);
  }

  logger.info('User rejected without documents', {
    userId,
    adminId,
    documentsCreated: results.length,
  });

  return {
    userId,
    documentsCreated: results.map(doc => ({
      id: doc.id.toString(),
      documentType: doc.document_type,
      documentName: doc.document_name,
      isVerified: doc.is_verified,
      rejectedAt: doc.rejected_at,
    })),
  };
};

export const acceptPolicyWithoutDocuments = async (policyId: string, adminId: string) => {
  const policy = await prisma.policy.findUnique({
    where: { id: BigInt(policyId) },
  });

  if (!policy) {
    throw new NotFoundError('Policy not found');
  }

  // Create placeholder accepted document
  const doc = await prisma.policyDocument.create({
    data: {
      policy_id: BigInt(policyId),
      document_type: 'OTHER',
      document_name: 'Admin Accepted - No Document Uploaded',
      document_url: '', // Empty URL for placeholder
      is_verified: true,
      verified_at: new Date(),
    },
  });

  logger.info('Policy accepted without documents', {
    policyId,
    adminId,
    documentId: doc.id.toString(),
  });

  return {
    id: doc.id.toString(),
    policyId: doc.policy_id.toString(),
    documentType: doc.document_type,
    documentName: doc.document_name,
    documentUrl: doc.document_url,
    isVerified: doc.is_verified,
    uploadedAt: doc.uploaded_at,
    verifiedAt: doc.verified_at,
  };
};

export const rejectPolicyWithoutDocuments = async (policyId: string, adminId: string) => {
  const policy = await prisma.policy.findUnique({
    where: { id: BigInt(policyId) },
  });

  if (!policy) {
    throw new NotFoundError('Policy not found');
  }

  // Create placeholder rejected document
  const doc = await prisma.policyDocument.create({
    data: {
      policy_id: BigInt(policyId),
      document_type: 'OTHER',
      document_name: 'Admin Rejected - No Document Uploaded',
      document_url: '', // Empty URL for placeholder
      is_verified: false,
      rejected_at: new Date(),
    },
  });

  logger.info('Policy rejected without documents', {
    policyId,
    adminId,
    documentId: doc.id.toString(),
  });

  return {
    id: doc.id.toString(),
    policyId: doc.policy_id.toString(),
    documentType: doc.document_type,
    documentName: doc.document_name,
    documentUrl: doc.document_url,
    isVerified: doc.is_verified,
    uploadedAt: doc.uploaded_at,
    rejectedAt: doc.rejected_at,
  };
};

export const acceptNomineeWithoutDocuments = async (nomineeId: string, adminId: string) => {
  const nominee = await prisma.nominee.findUnique({
    where: { id: BigInt(nomineeId) },
  });

  if (!nominee) {
    throw new NotFoundError('Nominee not found');
  }

  // Create placeholder accepted document
  const doc = await prisma.nomineeDocument.create({
    data: {
      nominee_id: BigInt(nomineeId),
      document_type: 'OTHER',
      document_name: 'Admin Accepted - No Document Uploaded',
      document_url: '', // Empty URL for placeholder
      is_verified: true,
      verified_at: new Date(),
    },
  });

  logger.info('Nominee accepted without documents', {
    nomineeId,
    adminId,
    documentId: doc.id.toString(),
  });

  return {
    id: doc.id.toString(),
    nomineeId: doc.nominee_id.toString(),
    documentType: doc.document_type,
    documentName: doc.document_name,
    documentUrl: doc.document_url,
    isVerified: doc.is_verified,
    uploadedAt: doc.uploaded_at,
    verifiedAt: doc.verified_at,
  };
};

export const rejectNomineeWithoutDocuments = async (nomineeId: string, adminId: string) => {
  const nominee = await prisma.nominee.findUnique({
    where: { id: BigInt(nomineeId) },
  });

  if (!nominee) {
    throw new NotFoundError('Nominee not found');
  }

  // Create placeholder rejected document
  const doc = await prisma.nomineeDocument.create({
    data: {
      nominee_id: BigInt(nomineeId),
      document_type: 'OTHER',
      document_name: 'Admin Rejected - No Document Uploaded',
      document_url: '', // Empty URL for placeholder
      is_verified: false,
    },
  });

  logger.info('Nominee rejected without documents', {
    nomineeId,
    adminId,
    documentId: doc.id.toString(),
  });

  return {
    id: doc.id.toString(),
    nomineeId: doc.nominee_id.toString(),
    documentType: doc.document_type,
    documentName: doc.document_name,
    documentUrl: doc.document_url,
    isVerified: doc.is_verified,
    uploadedAt: doc.uploaded_at,
    verifiedAt: doc.verified_at,
  };
};

export const getKycDocuments = async (
  page: number,
  limit: number,
  status: 'pending' | 'verified' | 'rejected',
  search?: string
) => {
  const offset = (page - 1) * limit;
  const documentTypes: UserDocumentType[] = ['AADHAAR', 'PAN'];

  // For pending: users who DON'T have all required documents verified (includes partially verified)
  // For verified: users who have all required document types verified AND have NO unverified documents
  // For rejected: users who have documents with rejected_at set (explicitly rejected by admin)
  let whereClause: any;
  
  // Base search filter for user name, email, or mobile number
  // MySQL's default collation (utf8mb4_unicode_ci) is case-insensitive, so contains works without mode
  // Handle email as nullable field - only search if email is not null
  const searchFilter = search && search.trim()
    ? {
        OR: [
          { name: { contains: search.trim() } },
          { email: { contains: search.trim() } },
          { mobile_number: { contains: search.trim() } },
        ],
      }
    : null;

  // Build base status conditions
  let statusConditions: any;
  
  if (status === 'rejected') {
    // Rejected: Users who have ALL documents rejected
    statusConditions = {
      AND: [
        // User has at least one document of required types
        {
          documents: {
            some: {
              document_type: { in: documentTypes },
            },
          },
        },
        // User has NO documents that are not rejected (all documents are rejected)
        {
          documents: {
            none: {
              document_type: { in: documentTypes },
              rejected_at: null,
            },
          },
        },
      ],
    };
  } else if (status === 'verified') {
    // Users who have all required document types verified AND have NO unverified documents
    statusConditions = {
      AND: [
        // User has all required document types verified
        ...documentTypes.map((docType) => ({
          documents: {
            some: {
              document_type: docType,
              is_verified: true,
            },
          },
        })),
        // User has NO unverified documents of required types
        {
          documents: {
            none: {
              document_type: { in: documentTypes },
              is_verified: false,
            },
          },
        },
      ],
    };
  } else {
    // Pending: Users who DON'T have all required documents verified OR have some (but not all) rejected documents
    statusConditions = {
      OR: [
        // User has no documents of required types
        {
          documents: {
            none: {
              document_type: { in: documentTypes },
            },
          },
        },
        // User has documents but does NOT have all required documents verified AND not all rejected
        {
          AND: [
            // User has at least one document of required types
            {
              documents: {
                some: {
                  document_type: { in: documentTypes },
                },
              },
            },
            // User does NOT have all required documents verified
            {
              NOT: {
                AND: documentTypes.map((docType) => ({
                  documents: {
                    some: {
                      document_type: docType,
                      is_verified: true,
                    },
                  },
                })),
              },
            },
            // User does NOT have all documents rejected (if all rejected, it's in rejected filter)
            {
              OR: [
                // User has at least one document that is not rejected
                {
                  documents: {
                    some: {
                      document_type: { in: documentTypes },
                      rejected_at: null,
                    },
                  },
                },
                // User has no documents (already covered above, but keeping for clarity)
                {
                  documents: {
                    none: {
                      document_type: { in: documentTypes },
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    };
  }

  // Combine status conditions with search filter and exclude inactive users
  const baseConditions = [
    statusConditions,
    { subscription_status: { not: 'INACTIVE' } }, // Exclude inactive users
  ];
  
  if (searchFilter) {
    baseConditions.push(searchFilter);
  }
  
  whereClause = {
    AND: baseConditions,
  };

  // Log the search query for debugging
  if (search) {
    logger.debug('KYC Documents search', {
      search,
      status,
      whereClause: JSON.stringify(whereClause).substring(0, 500), // Log first 500 chars
    });
  }

  const totalUsers = await prisma.user.count({
    where: whereClause,
  });

  const users = await prisma.user.findMany({
    where: whereClause,
    include: {
      documents: {
        where: {
          // Show all documents of required types for all statuses
          document_type: { in: documentTypes },
          // For pending status, exclude rejected documents
          ...(status === 'pending' ? { rejected_at: null } : {}),
        },
        orderBy: { uploaded_at: 'desc' },
      },
    },
    orderBy: { created_at: 'desc' },
    skip: offset,
    take: limit,
  });

  return {
    users: users.map((user) => ({
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      mobileNumber: user.mobile_number,
      documents: user.documents.map((doc) => ({
        id: doc.id.toString(),
        documentType: doc.document_type,
        documentName: doc.document_name,
        documentUrl: doc.document_url,
        isVerified: doc.is_verified,
        uploadedAt: doc.uploaded_at,
        verifiedAt: doc.verified_at,
        rejectedAt: doc.rejected_at,
      })),
      pendingDocuments: documentTypes.filter(
        (type) => !user.documents.some((doc) => doc.document_type === type)
      ),
      verifiedDocuments: user.documents.filter((doc) => doc.is_verified).map((doc) => doc.document_type),
    })),
    pagination: {
      page,
      limit,
      total: totalUsers,
      totalPages: Math.ceil(totalUsers / limit) || 1,
    },
  };
};

export const getPolicyDocuments = async (
  page: number,
  limit: number,
  status: 'pending' | 'verified' | 'rejected',
  search?: string
) => {
  const offset = (page - 1) * limit;

  // Base search filter for user name, email, mobile number, or policy number
  const searchFilter = search && search.trim()
    ? {
        OR: [
          { user: { name: { contains: search.trim() } } },
          { user: { email: { contains: search.trim() } } },
          { user: { mobile_number: { contains: search.trim() } } },
          { policy_number: { contains: search.trim() } },
        ],
      }
    : null;

  // Build status conditions
  let statusConditions: any;

  if (status === 'verified') {
    // Policies that have all documents verified AND have NO unverified documents
    statusConditions = {
      AND: [
        // Policy has at least one document
        {
          documents: {
            some: {},
          },
        },
        // Policy has NO unverified documents
        {
          documents: {
            none: {
              is_verified: false,
            },
          },
        },
      ],
    };
  } else if (status === 'rejected') {
    // Rejected: Policies that have ALL documents rejected
    statusConditions = {
      AND: [
        // Policy has at least one document
        {
          documents: {
            some: {},
          },
        },
        // Policy has NO documents that are not rejected (all documents are rejected)
        {
          documents: {
            none: {
              rejected_at: null,
            },
          },
        },
      ],
    };
  } else {
    // Pending: Policies that have NO verified documents OR have some (but not all) rejected documents
    statusConditions = {
      OR: [
        // Policy has no documents
        {
          documents: {
            none: {},
          },
        },
        // Policy has documents but none are verified AND not all rejected
        {
          AND: [
            {
              documents: {
                some: {},
              },
            },
            {
              documents: {
                none: {
                  is_verified: true,
                },
              },
            },
            // Policy has at least one document that is not rejected (if all rejected, it's in rejected filter)
            {
              documents: {
                some: {
                  rejected_at: null,
                },
              },
            },
          ],
        },
      ],
    };
  }

  // Combine status conditions with search filter and exclude inactive users
  const baseConditions = [
    statusConditions,
    { user: { subscription_status: { not: 'INACTIVE' } } }, // Exclude policies from inactive users
  ];
  
  if (searchFilter) {
    baseConditions.push(searchFilter);
  }
  
  let whereClause: any = {
    AND: baseConditions,
  };

  // Count total before fetching
  const totalPolicies = await prisma.policy.count({ where: whereClause });

  // Fetch policies with pagination
  const policies = await prisma.policy.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          mobile_number: true,
        },
      },
      insurance_company: {
        select: {
          id: true,
          name: true,
        },
      },
      documents: {
        orderBy: { uploaded_at: 'desc' },
      },
    },
    orderBy: { uploaded_at: 'desc' },
    skip: offset,
    take: limit,
  });

  return {
    policies: policies.map((policy) => ({
      id: policy.id.toString(),
      policyNumber: policy.policy_number,
      sumAssured: policy.sum_assured.toString(),
      status: policy.status,
      uploadedAt: policy.uploaded_at,
      user: {
        id: policy.user.id.toString(),
        name: policy.user.name,
        email: policy.user.email,
        mobileNumber: policy.user.mobile_number,
      },
      insuranceCompany: {
        id: policy.insurance_company.id.toString(),
        name: policy.insurance_company.name,
      },
      documents: policy.documents.map((doc) => ({
        id: doc.id.toString(),
        documentType: doc.document_type,
        documentName: doc.document_name,
        documentUrl: doc.document_url,
        isVerified: doc.is_verified,
        uploadedAt: doc.uploaded_at,
        verifiedAt: doc.verified_at,
        rejectedAt: doc.rejected_at,
      })),
      verifiedDocuments: policy.documents.filter((doc) => doc.is_verified).map((doc) => doc.id.toString()),
    })),
    pagination: {
      page,
      limit,
      total: totalPolicies,
      totalPages: Math.ceil(totalPolicies / limit) || 1,
    },
  };
};

export const getNomineeDocuments = async (
  page: number,
  limit: number,
  status: 'pending' | 'verified' | 'rejected',
  search?: string
) => {
  const offset = (page - 1) * limit;

  // Base search filter for user name, email, mobile number, or nominee name
  const searchFilter = search && search.trim()
    ? {
        OR: [
          { user: { name: { contains: search.trim() } } },
          { user: { email: { contains: search.trim() } } },
          { user: { mobile_number: { contains: search.trim() } } },
          { name: { contains: search.trim() } },
        ],
      }
    : null;

  // Build status conditions
  let statusConditions: any;

  if (status === 'verified') {
    // Nominees that have all documents verified AND have NO unverified documents
    statusConditions = {
      AND: [
        // Nominee has at least one document
        {
          documents: {
            some: {},
          },
        },
        // Nominee has NO unverified documents
        {
          documents: {
            none: {
              is_verified: false,
            },
          },
        },
      ],
    };
  } else if (status === 'rejected') {
    // Rejected: Nominees that have ALL documents rejected
    statusConditions = {
      AND: [
        // Nominee has at least one document
        {
          documents: {
            some: {},
          },
        },
        // Nominee has NO documents that are not rejected (all documents are rejected)
        {
          documents: {
            none: {
              rejected_at: null,
            },
          },
        },
      ],
    };
  } else {
    // Pending: Nominees that don't have all documents verified AND don't have all documents rejected
    statusConditions = {
      OR: [
        // Nominee has no documents
        {
          documents: {
            none: {},
          },
        },
        // Nominee has documents but not all verified AND not all rejected
        {
          AND: [
            {
              documents: {
                some: {},
              },
            },
            // Not all documents are verified (has at least one unverified document)
            {
              documents: {
                some: {
                  is_verified: false,
                },
              },
            },
            // Not all documents are rejected (has at least one document that is not rejected)
            {
              documents: {
                some: {
                  rejected_at: null,
                },
              },
            },
          ],
        },
      ],
    };
  }

  // Combine status conditions with search filter and exclude inactive users
  const baseConditions = [
    statusConditions,
    { user: { subscription_status: { not: 'INACTIVE' } } }, // Exclude nominees from inactive users
  ];
  
  if (searchFilter) {
    baseConditions.push(searchFilter);
  }
  
  let whereClause: any = {
    AND: baseConditions,
  };

  // Count total before fetching
  const totalNominees = await prisma.nominee.count({ where: whereClause });

  // Fetch nominees with pagination
  const nominees = await prisma.nominee.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          mobile_number: true,
        },
      },
      documents: {
        orderBy: { uploaded_at: 'desc' },
      },
    },
    orderBy: { created_at: 'desc' },
    skip: offset,
    take: limit,
  });

  return {
    nominees: nominees.map((nominee) => ({
      id: nominee.id.toString(),
      name: nominee.name,
      relationship: nominee.relationship,
      mobileNumber: nominee.mobile_number,
      email: nominee.email,
      address: nominee.address,
      createdAt: nominee.created_at,
      updatedAt: nominee.updated_at,
      user: {
        id: nominee.user.id.toString(),
        name: nominee.user.name,
        email: nominee.user.email,
        mobileNumber: nominee.user.mobile_number,
      },
      documents: nominee.documents.map((doc) => ({
        id: doc.id.toString(),
        documentType: doc.document_type,
        documentName: doc.document_name,
        documentUrl: doc.document_url,
        isVerified: doc.is_verified,
        uploadedAt: doc.uploaded_at,
        verifiedAt: doc.verified_at,
        rejectedAt: doc.rejected_at,
      })),
      verifiedDocuments: nominee.documents.filter((doc) => doc.is_verified).map((doc) => doc.id.toString()),
    })),
    pagination: {
      page,
      limit,
      total: totalNominees,
      totalPages: Math.ceil(totalNominees / limit) || 1,
    },
  };
};


