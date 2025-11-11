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
    },
  });

  logger.info('Policy document rejected/unverified', {
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
  const searchFilter = search
    ? {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { mobile_number: { contains: search } },
        ],
      }
    : {};

  if (status === 'verified') {
    // Users who have all required document types verified AND have NO unverified documents
    // This means: user has AADHAAR verified AND has PAN verified AND has no unverified AADHAAR/PAN documents
    whereClause = {
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
        // Apply search filter if provided
        ...(Object.keys(searchFilter).length > 0 ? [searchFilter] : []),
      ],
    };
  } else if (status === 're-verification') {
    // Users who have all required document types verified BUT have at least one unverified document
    // This covers: verified users who uploaded new documents
    whereClause = {
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
        // Apply search filter if provided
        ...(Object.keys(searchFilter).length > 0 ? [searchFilter] : []),
      ],
    };
  } else {
    // Pending: Users who DON'T have all required documents verified (first-time verification)
    // This includes:
    // 1. Users with no documents of required types (need to upload)
    // 2. Users with documents but NOT all required types verified
    // Excludes: Users who have all required documents verified (those go to re-verification if they have new docs)
    const pendingConditions = {
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
    
    whereClause = Object.keys(searchFilter).length > 0
      ? {
          AND: [
            pendingConditions,
            searchFilter,
          ],
        }
      : pendingConditions;
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


