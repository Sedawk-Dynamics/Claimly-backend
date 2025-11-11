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
  };
};

export const verifyPolicyDocument = async (documentId: string, adminId: string) => {
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
      is_verified: true,
      verified_at: new Date(),
      rejected_at: null, // Clear rejection when verifying
    },
  });

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
    },
  });

  logger.info('User document rejected/unverified', {
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

export const getKycDocuments = async (
  page: number,
  limit: number,
  status: 'pending' | 'verified' | 're-verification',
  search?: string
) => {
  const offset = (page - 1) * limit;
  const documentTypes: UserDocumentType[] = ['AADHAAR', 'PAN'];

  // For pending: users who DON'T have all required documents verified (first-time verification)
  // For verified: users who have all required documents verified AND have NO unverified documents
  // For re-verification: users who have all required documents verified BUT have new unverified documents
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
  
  if (status === 'verified') {
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
  } else if (status === 're-verification') {
    // Users who have all required document types verified BUT have at least one unverified document
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
        // User also has at least one unverified document of required types
        {
          documents: {
            some: {
              document_type: { in: documentTypes },
              is_verified: false,
            },
          },
        },
      ],
    };
  } else {
    // Pending: Users who DON'T have all required documents verified (first-time verification)
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
        // User has documents but does NOT have all required documents verified
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
          ],
        },
      ],
    };
  }

  // Combine status conditions with search filter if provided
  if (searchFilter) {
    whereClause = {
      AND: [
        statusConditions,
        searchFilter,
      ],
    };
  } else {
    whereClause = statusConditions;
  }

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

export const getReVerificationDocuments = async (page: number, limit: number) => {
  // Get user documents that need re-verification (is_verified: false AND verified_at IS NOT NULL)
  const [userDocuments, policyDocuments, nomineeDocuments, totalUserDocs, totalPolicyDocs, totalNomineeDocs] = await Promise.all([
    prisma.userDocument.findMany({
      where: {
        is_verified: false,
        verified_at: {
          not: null,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile_number: true,
          },
        },
      },
      orderBy: { uploaded_at: 'desc' },
    }),
    prisma.policyDocument.findMany({
      where: {
        is_verified: false,
        verified_at: {
          not: null,
        },
      },
      include: {
        policy: {
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
          },
        },
      },
      orderBy: { uploaded_at: 'desc' },
    }),
    prisma.nomineeDocument.findMany({
      where: {
        is_verified: false,
        verified_at: {
          not: null,
        },
      },
      include: {
        nominee: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                mobile_number: true,
              },
            },
          },
        },
      },
      orderBy: { uploaded_at: 'desc' },
    }),
    prisma.userDocument.count({
      where: {
        is_verified: false,
        verified_at: {
          not: null,
        },
      },
    }),
    prisma.policyDocument.count({
      where: {
        is_verified: false,
        verified_at: {
          not: null,
        },
      },
    }),
    prisma.nomineeDocument.count({
      where: {
        is_verified: false,
        verified_at: {
          not: null,
        },
      },
    }),
  ]);

  const total = totalUserDocs + totalPolicyDocs + totalNomineeDocs;

  // Combine and format all documents
  const documents = [
    ...userDocuments.map((doc) => ({
      id: doc.id.toString(),
      documentType: 'USER' as const,
      documentName: doc.document_name,
      documentUrl: doc.document_url,
      documentTypeDetail: doc.document_type,
      isVerified: doc.is_verified,
      uploadedAt: doc.uploaded_at,
      verifiedAt: doc.verified_at,
      user: {
        id: doc.user.id.toString(),
        name: doc.user.name,
        email: doc.user.email,
        mobileNumber: doc.user.mobile_number,
      },
      policy: null,
      nominee: null,
    })),
    ...policyDocuments.map((doc) => ({
      id: doc.id.toString(),
      documentType: 'POLICY' as const,
      documentName: doc.document_name,
      documentUrl: doc.document_url,
      documentTypeDetail: doc.document_type,
      isVerified: doc.is_verified,
      uploadedAt: doc.uploaded_at,
      verifiedAt: doc.verified_at,
      user: {
        id: doc.policy.user.id.toString(),
        name: doc.policy.user.name,
        email: doc.policy.user.email,
        mobileNumber: doc.policy.user.mobile_number,
      },
      policy: {
        id: doc.policy.id.toString(),
        policyNumber: doc.policy.policy_number,
        insuranceCompany: doc.policy.insurance_company.name,
      },
      nominee: null,
    })),
    ...nomineeDocuments.map((doc) => ({
      id: doc.id.toString(),
      documentType: 'NOMINEE' as const,
      documentName: doc.document_name,
      documentUrl: doc.document_url,
      documentTypeDetail: doc.document_type,
      isVerified: doc.is_verified,
      uploadedAt: doc.uploaded_at,
      verifiedAt: doc.verified_at,
      user: {
        id: doc.nominee.user.id.toString(),
        name: doc.nominee.user.name,
        email: doc.nominee.user.email,
        mobileNumber: doc.nominee.user.mobile_number,
      },
      policy: null,
      nominee: {
        id: doc.nominee.id.toString(),
        name: doc.nominee.name,
        relationship: doc.nominee.relationship,
      },
    })),
  ].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  // Apply pagination to combined results
  const offset = (page - 1) * limit;
  const paginatedDocuments = documents.slice(offset, offset + limit);

  return {
    documents: paginatedDocuments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getPolicyDocuments = async (
  page: number,
  limit: number,
  status: 'pending' | 'verified' | 're-verification' | 'rejected',
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
  } else if (status === 're-verification') {
    // Re-verification: Policies that have verified documents AND have NEW unverified documents
    // NEW means: unverified documents uploaded AFTER the latest verification date
    // Note: When verification is removed (verified_at becomes null), it goes to pending, not re-verification
    // We'll fetch policies with both verified and unverified docs, then filter in application logic
    statusConditions = {
      AND: [
        // Policy has at least one verified document
        {
          documents: {
            some: {
              is_verified: true,
              verified_at: { not: null },
            },
          },
        },
        // Policy has at least one unverified document
        {
          documents: {
            some: {
              is_verified: false,
            },
          },
        },
      ],
    };
  } else if (status === 'rejected') {
    // Rejected: Policies that have documents with rejected_at set (explicitly rejected by admin)
    statusConditions = {
      // Policy must have at least one document that was rejected
      documents: {
        some: {
          rejected_at: { not: null },
        },
      },
    };
  } else {
    // Pending: Policies that have NO verified documents AND NO rejected documents
    // This includes:
    // 1. Policies with no documents
    // 2. Policies with documents but none are verified or rejected (first-time or after verification removal)
    statusConditions = {
      OR: [
        // Policy has no documents
        {
          documents: {
            none: {},
          },
        },
        // Policy has documents but none are verified or rejected
        // This covers both first-time verification and cases where verification was removed
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
            {
              documents: {
                none: {
                  rejected_at: { not: null },
                },
              },
            },
          ],
        },
      ],
    };
  }

  // Combine status conditions with search filter if provided
  let whereClause: any;
  if (searchFilter) {
    whereClause = {
      AND: [
        statusConditions,
        searchFilter,
      ],
    };
  } else {
    whereClause = statusConditions;
  }

  // Fetch all policies matching the base criteria
  let policies = await prisma.policy.findMany({
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
  });

  // For re-verification status, filter to only include policies where unverified documents
  // were uploaded AFTER the latest verification date (indicating new documents, not removed verification)
  // When verification is removed (verified_at becomes null), it goes to pending, not re-verification
  if (status === 're-verification') {
    policies = policies.filter((policy) => {
      const verifiedDocs = policy.documents.filter((doc) => doc.is_verified && doc.verified_at);
      const unverifiedDocs = policy.documents.filter((doc) => !doc.is_verified);

      if (verifiedDocs.length === 0 || unverifiedDocs.length === 0) {
        return false;
      }

      // Find the latest verification date
      const latestVerificationDate = verifiedDocs
        .map((doc) => doc.verified_at!)
        .sort((a, b) => b.getTime() - a.getTime())[0];

      // Check if any unverified document was uploaded AFTER the latest verification
      // This indicates a new document was uploaded, not that verification was removed
      const hasNewUnverifiedDocs = unverifiedDocs.some(
        (doc) => doc.uploaded_at > latestVerificationDate
      );

      return hasNewUnverifiedDocs;
    });
  }

  // For rejected status, we already filtered at the database level using rejected_at
  // No additional filtering needed since we're using the rejected_at field directly

  // Count total after filtering (for re-verification and rejected) or use database count (for others)
  const totalPolicies = (status === 're-verification' || status === 'rejected')
    ? policies.length 
    : await prisma.policy.count({ where: whereClause });

  // Apply pagination after filtering
  const paginatedPolicies = policies.slice(offset, offset + limit);

  return {
    policies: paginatedPolicies.map((policy) => ({
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


