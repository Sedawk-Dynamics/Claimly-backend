import prisma from '../config/prismaClient';
import { NotFoundError } from '../utils/errors';
import logger from '../config/logger';
import type { UserDocumentType } from '@prisma/client';
import { sendAdminActionNotification } from './notification.service';

const areAllDocumentsVerified = (documents: Array<{ is_verified: boolean }>) =>
  documents.length > 0 && documents.every((doc) => doc.is_verified);

const areAllDocumentsRejected = (documents: Array<{ rejected_at: Date | null }>) =>
  documents.length > 0 && documents.every((doc) => doc.rejected_at !== null);

/**
 * Calculate KYC verification status based on documents
 * @param documents Array of user documents (AADHAAR and PAN)
 * @param documentTypes Required document types (AADHAAR, PAN)
 * @returns Status: 'REJECTED' | 'ACCEPTED' | 'PENDING' | 'DRAFT'
 */
const calculateKycStatus = (
  documents: Array<{
    document_type: string;
    is_verified: boolean;
    rejected_at: Date | null;
  }>,
  documentTypes: UserDocumentType[]
): 'REJECTED' | 'ACCEPTED' | 'PENDING' | 'DRAFT' => {
  // Filter documents to only required types
  const kycDocuments = documents.filter((doc) => documentTypes.includes(doc.document_type as UserDocumentType));
  
  // Check which document types are present
  const hasAadhaar = kycDocuments.some((doc) => doc.document_type === 'AADHAAR');
  const hasPan = kycDocuments.some((doc) => doc.document_type === 'PAN');
  
  // DRAFT: Only 1 document uploaded and 1 not uploaded, or no documents at all
  if (!hasAadhaar || !hasPan) {
    return 'DRAFT';
  }
  
  // Get verified and rejected counts
  const verifiedDocs = kycDocuments.filter((doc) => doc.is_verified);
  const rejectedDocs = kycDocuments.filter((doc) => doc.rejected_at !== null);
  const totalDocs = kycDocuments.length;
  
  // REJECTED: All documents are rejected
  if (rejectedDocs.length === totalDocs && totalDocs > 0) {
    return 'REJECTED';
  }
  
  // ACCEPTED: All documents are verified
  if (verifiedDocs.length === totalDocs && totalDocs > 0) {
    return 'ACCEPTED';
  }
  
  // PENDING: Any other case (includes 1 accepted and 1 rejected, or partially verified)
  return 'PENDING';
};

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

  // Send notification to user
  await sendAdminActionNotification(adminId, document.user_id.toString(), 'DOCUMENT_VERIFIED', {
    documentType: updatedDocument.document_type,
    documentName: updatedDocument.document_name,
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

  const policyWithRelations = await prisma.policy.findUnique({
    where: { id: document.policy_id },
    include: {
      documents: true,
      user: true,
      policy_nominees: {
        include: {
          nominee: {
            include: {
              documents: true,
            },
          },
        },
      },
    },
  });

  if (policyWithRelations) {
    const allVerified = areAllDocumentsVerified(policyWithRelations.documents);
    let nextStatus: 'PENDING' | 'ACCEPTED' | null = null;

    // Check if all nominees are verified before allowing policy to be ACCEPTED
    if (allVerified) {
      // Check if there are any nominees linked to this policy
      if (policyWithRelations.policy_nominees.length > 0) {
        // Check if all nominees have all their documents verified
        const allNomineesVerified = policyWithRelations.policy_nominees.every((pn) => {
          const nomineeDocs = pn.nominee.documents;
          return nomineeDocs.length > 0 && nomineeDocs.every((doc) => doc.is_verified);
        });

        if (allNomineesVerified) {
          nextStatus = 'ACCEPTED';
        } else {
          // Policy documents are verified but nominees are not - keep as PENDING
          nextStatus = policyWithRelations.status === 'DRAFT' ? 'PENDING' : null;
          logger.info('Policy documents verified but nominees not verified', {
            policyId: policyWithRelations.id.toString(),
            nomineesCount: policyWithRelations.policy_nominees.length,
          });
        }
      } else {
        // No nominees linked - can accept policy
        nextStatus = 'ACCEPTED';
      }
    } else if (policyWithRelations.status === 'DRAFT') {
      nextStatus = 'PENDING';
    }

    if (nextStatus && nextStatus !== policyWithRelations.status) {
      await prisma.policy.update({
        where: { id: policyWithRelations.id },
        data: { status: nextStatus },
      });

      const notificationType = nextStatus === 'ACCEPTED' ? 'POLICY_ACCEPTED' : 'POLICY_PENDING';
      await sendAdminActionNotification(
        adminId,
        policyWithRelations.user_id.toString(),
        notificationType,
        {
          policyNumber: policyWithRelations.policy_number,
        }
      );

      logger.info('Policy status updated after verification', {
        policyId: policyWithRelations.id.toString(),
        adminId,
        nextStatus,
      });
    }

    await sendAdminActionNotification(
      adminId,
      policyWithRelations.user_id.toString(),
      'POLICY_DOCUMENT_VERIFIED',
      {
        documentName: updatedDocument.document_name,
        policyNumber: policyWithRelations.policy_number,
      }
    );
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
  });

  if (!document) {
    throw new NotFoundError('Nominee document not found');
  }

  const updatedDocument = await prisma.nomineeDocument.update({
    where: { id: BigInt(documentId) },
    data: {
      is_verified: true,
      verified_at: new Date(),
      rejected_at: null,
    },
  });

  const nomineeWithRelations = await prisma.nominee.findUnique({
    where: { id: document.nominee_id },
    include: {
      documents: true,
      user: true,
    },
  });

  if (nomineeWithRelations) {
    const allVerified = areAllDocumentsVerified(nomineeWithRelations.documents);
    let nextStatus: 'PENDING' | 'ACCEPTED' | null = null;

    if (allVerified) {
      nextStatus = 'ACCEPTED';
    } else if (nomineeWithRelations.status === 'DRAFT') {
      nextStatus = 'PENDING';
    }

    if (nextStatus && nextStatus !== nomineeWithRelations.status) {
      await prisma.nominee.update({
        where: { id: nomineeWithRelations.id },
        data: { status: nextStatus },
      });

      if (nextStatus === 'ACCEPTED') {
        await sendAdminActionNotification(
          adminId,
          nomineeWithRelations.user_id.toString(),
          'NOMINEE_ACCEPTED',
          {
            nomineeName: nomineeWithRelations.name,
          }
        );
      }

      logger.info('Nominee status updated after verification', {
        nomineeId: nomineeWithRelations.id.toString(),
        adminId,
        nextStatus,
      });
    }

    await sendAdminActionNotification(
      adminId,
      nomineeWithRelations.user_id.toString(),
      'NOMINEE_DOCUMENT_VERIFIED',
      {
        nomineeName: nomineeWithRelations.name,
        documentName: updatedDocument.document_name,
      }
    );
  }

  logger.info('Nominee document verified', {
    documentId,
    adminId,
    nomineeId: document.nominee_id.toString(),
  });

  // After nominee document verification, re-evaluate policies linked to this nominee.
  // If a policy has all its documents verified and all its nominees' documents are verified,
  // mark the policy as ACCEPTED.
  try {
    const links = await prisma.policyNominee.findMany({
      where: { nominee_id: document.nominee_id },
      include: {
        policy: {
          include: {
            documents: true,
            policy_nominees: {
              include: {
                nominee: {
                  include: { documents: true },
                },
              },
            },
            user: true,
          },
        },
      },
    });

    for (const link of links) {
      const policy = link.policy;
      if (!policy) continue;

      const policyDocsAllVerified = areAllDocumentsVerified(policy.documents);

      let allNomineesDocsVerified = true;
      if (policy.policy_nominees.length > 0) {
        allNomineesDocsVerified = policy.policy_nominees.every((pn) => {
          const ndocs = pn.nominee.documents || [];
          return ndocs.length > 0 && ndocs.every((d) => d.is_verified);
        });
      }

      if (policyDocsAllVerified && allNomineesDocsVerified && policy.status !== 'ACCEPTED') {
        await prisma.policy.update({
          where: { id: policy.id },
          data: { status: 'ACCEPTED' },
        });

        await sendAdminActionNotification(adminId, policy.user_id.toString(), 'POLICY_ACCEPTED', {
          policyNumber: policy.policy_number,
        }).catch((err) => {
          logger.warn('Failed to send POLICY_ACCEPTED notification', { policyId: policy.id.toString(), err });
        });

        logger.info('Policy accepted after nominee verification', { policyId: policy.id.toString(), nomineeId: document.nominee_id.toString(), adminId });
      }
    }
  } catch (err) {
    logger.error('Failed to re-evaluate policies after nominee verification', { error: err });
  }
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

  // Send notification to user
  await sendAdminActionNotification(adminId, document.user_id.toString(), 'DOCUMENT_REJECTED', {
    documentType: updatedDocument.document_type,
    documentName: updatedDocument.document_name,
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

  const policyWithRelations = await prisma.policy.findUnique({
    where: { id: document.policy_id },
    include: {
      documents: true,
      user: true,
    },
  });

  if (policyWithRelations) {
    const allRejected = areAllDocumentsRejected(policyWithRelations.documents);
    let nextStatus: 'REJECTED' | 'PENDING' | null = null;

    if (allRejected) {
      nextStatus = 'REJECTED';
    } else if (policyWithRelations.status === 'ACCEPTED' || policyWithRelations.status === 'REJECTED') {
      nextStatus = 'PENDING';
    }

    if (nextStatus && nextStatus !== policyWithRelations.status) {
      await prisma.policy.update({
        where: { id: policyWithRelations.id },
        data: { status: nextStatus },
      });

      const notificationType = nextStatus === 'REJECTED' ? 'POLICY_REJECTED' : 'POLICY_PENDING';
      await sendAdminActionNotification(
        adminId,
        policyWithRelations.user_id.toString(),
        notificationType,
        {
          policyNumber: policyWithRelations.policy_number,
        }
      );

      logger.info('Policy status updated after rejection', {
        policyId: policyWithRelations.id.toString(),
        adminId,
        nextStatus,
      });
    }

    await sendAdminActionNotification(
      adminId,
      policyWithRelations.user_id.toString(),
      'POLICY_DOCUMENT_REJECTED',
      {
        documentName: updatedDocument.document_name,
        policyNumber: policyWithRelations.policy_number,
      }
    );
  }

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
      rejected_at: new Date(),
    },
  });

  const nomineeWithRelations = await prisma.nominee.findUnique({
    where: { id: document.nominee_id },
    include: {
      documents: true,
      user: true,
    },
  });

  if (nomineeWithRelations) {
    const allRejected = areAllDocumentsRejected(nomineeWithRelations.documents);
    let nextStatus: 'REJECTED' | 'PENDING' | null = null;

    if (allRejected) {
      nextStatus = 'REJECTED';
    } else if (nomineeWithRelations.status === 'ACCEPTED' || nomineeWithRelations.status === 'REJECTED') {
      nextStatus = 'PENDING';
    }

    if (nextStatus && nextStatus !== nomineeWithRelations.status) {
      await prisma.nominee.update({
        where: { id: nomineeWithRelations.id },
        data: { status: nextStatus },
      });

      if (nextStatus === 'REJECTED') {
        await sendAdminActionNotification(
          adminId,
          nomineeWithRelations.user_id.toString(),
          'NOMINEE_REJECTED',
          {
            nomineeName: nomineeWithRelations.name,
          }
        );
      }

      logger.info('Nominee status updated after rejection', {
        nomineeId: nomineeWithRelations.id.toString(),
        adminId,
        nextStatus,
      });
    }

    await sendAdminActionNotification(
      adminId,
      nomineeWithRelations.user_id.toString(),
      'NOMINEE_DOCUMENT_REJECTED',
      {
        nomineeName: nomineeWithRelations.name,
        documentName: updatedDocument.document_name,
      }
    );
  }

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

  // Send notification to user
  await sendAdminActionNotification(adminId, userId, 'KYC_ACCEPTED');

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

export const verifyUserDetails = async (userId: string, adminId: string) => {
  // Reuse acceptUserWithoutDocuments to mark user KYC accepted when admin verifies details
  return await acceptUserWithoutDocuments(userId, adminId);
};

export const verifyNomineeDetails = async (nomineeId: string, adminId: string) => {
  // Reuse acceptNomineeWithoutDocuments to accept nominee when admin verifies details
  return await acceptNomineeWithoutDocuments(nomineeId, adminId);
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

  // Send notification to user
  await sendAdminActionNotification(adminId, userId, 'KYC_REJECTED');

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

  // Send notification to user
  await sendAdminActionNotification(adminId, policy.user_id.toString(), 'POLICY_ACCEPTED', {
    policyNumber: policy.policy_number,
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

  // Send notification to user
  await sendAdminActionNotification(adminId, policy.user_id.toString(), 'POLICY_REJECTED', {
    policyNumber: policy.policy_number,
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

  // Update nominee status to ACCEPTED
  await prisma.nominee.update({
    where: { id: BigInt(nomineeId) },
    data: { status: 'ACCEPTED' },
  });

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

  // Send notification to user
  await sendAdminActionNotification(adminId, nominee.user_id.toString(), 'NOMINEE_ACCEPTED', {
    nomineeName: nominee.name,
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

/**
 * Admin verifies policy details (non-document verification) via button in admin panel.
 * This marks the policy ACCEPTED regardless of document placeholders. Useful when admin
 * validates fields like policy number, sum assured, company etc.
 */
export const verifyPolicyDetails = async (policyId: string, adminId: string) => {
  const policy = await prisma.policy.findUnique({
    where: { id: BigInt(policyId) },
    include: { user: true },
  });

  if (!policy) {
    throw new NotFoundError('Policy not found');
  }

  if (policy.status === 'ACCEPTED') {
    return {
      message: 'Policy already accepted',
      policyId: policy.id.toString(),
      status: policy.status,
    };
  }

  await prisma.policy.update({
    where: { id: BigInt(policyId) },
    data: { status: 'ACCEPTED' },
  });

  // Notify user
  await sendAdminActionNotification(adminId, policy.user_id.toString(), 'POLICY_ACCEPTED', {
    policyNumber: policy.policy_number,
  }).catch((err) => {
    logger.warn('Failed to send POLICY_ACCEPTED notification after details verification', { policyId, err });
  });

  logger.info('Policy details verified by admin', { policyId, adminId });

  return {
    message: 'Policy details verified and policy accepted',
    policyId: policy.id.toString(),
    status: 'ACCEPTED',
  };
};

export const deleteUserDocumentByAdmin = async (documentId: string, adminId: string) => {
  const document = await prisma.userDocument.findUnique({
    where: { id: BigInt(documentId) },
    include: { user: true },
  });

  if (!document) {
    throw new NotFoundError('User document not found');
  }

  // Extract filename from URL
  const urlParts = document.document_url.split('/');
  const filename = urlParts[urlParts.length - 1];

  // Delete file from filesystem
  const { deleteFile } = await import('../utils/fileUpload');
  try {
    deleteFile(filename, 'users');
  } catch (error) {
    logger.warn('Failed to delete file from filesystem', { filename, error });
    // Continue with database deletion even if file deletion fails
  }

  // Delete from database
  await prisma.userDocument.delete({
    where: { id: BigInt(documentId) },
  });

  logger.info('User document deleted by admin', {
    documentId,
    adminId,
    userId: document.user_id.toString(),
    documentType: document.document_type,
  });

  return {
    message: 'Document deleted successfully',
    documentId: document.id.toString(),
    userId: document.user_id.toString(),
  };
};

export const rejectNomineeWithoutDocuments = async (nomineeId: string, adminId: string) => {
  const nominee = await prisma.nominee.findUnique({
    where: { id: BigInt(nomineeId) },
  });

  if (!nominee) {
    throw new NotFoundError('Nominee not found');
  }

  // Update nominee status to REJECTED
  await prisma.nominee.update({
    where: { id: BigInt(nomineeId) },
    data: { status: 'REJECTED' },
  });

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

  // Send notification to user
  await sendAdminActionNotification(adminId, nominee.user_id.toString(), 'NOMINEE_REJECTED', {
    nomineeName: nominee.name,
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
  status: 'pending' | 'verified' | 'rejected' | 'draft' | 'all',
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
          { 
            AND: [
              { email: { not: null } },
              { email: { contains: search.trim() } }
            ]
          },
          { mobile_number: { contains: search.trim() } },
        ],
      }
    : null;

  // Build base status conditions
  let statusConditions: any;
  
  if (status === 'all') {
    // All: Return all users regardless of status (only exclude inactive users)
    statusConditions = {};
  } else if (status === 'rejected') {
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
  } else if (status === 'draft') {
    // Draft: Users who have only 1 document uploaded (1 document missing)
    statusConditions = {
      OR: [
        // User has AADHAAR but not PAN
        {
          AND: [
            {
              documents: {
                some: {
                  document_type: 'AADHAAR',
                },
              },
            },
            {
              documents: {
                none: {
                  document_type: 'PAN',
                },
              },
            },
          ],
        },
        // User has PAN but not AADHAAR
        {
          AND: [
            {
              documents: {
                some: {
                  document_type: 'PAN',
                },
              },
            },
            {
              documents: {
                none: {
                  document_type: 'AADHAAR',
                },
              },
            },
          ],
        },
        // User has no documents at all
        {
          documents: {
            none: {
              document_type: { in: documentTypes },
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
  const baseConditions: any[] = [
    { subscription_status: { not: 'INACTIVE' } }, // Exclude inactive users
  ];
  
  // Only add statusConditions if not 'all' (for 'all', we want all statuses)
  if (status !== 'all') {
    baseConditions.push(statusConditions);
  }
  
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

  try {
    const totalUsers = await prisma.user.count({
      where: whereClause,
    });

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        documents: {
          where: {
            // Fetch ALL documents for status calculation
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
      users: users.map((user) => {
        // Calculate KYC status based on ALL documents (not filtered)
        const kycStatus = calculateKycStatus(user.documents, documentTypes);
        
        // Always return ALL documents so admin can see the complete picture
        // This allows admin to see rejected documents even when one is accepted
        return {
          id: user.id.toString(),
          name: user.name,
          email: user.email,
          mobileNumber: user.mobile_number,
          status: kycStatus,
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
        };
      }),
      pagination: {
        page,
        limit,
        total: totalUsers,
        totalPages: Math.ceil(totalUsers / limit) || 1,
      },
    };
  } catch (error) {
    logger.error('Error fetching KYC documents', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      page,
      limit,
      status,
      search,
    });
    throw error;
  }
};

export const getPolicyDocuments = async (
  page: number,
  limit: number,
  status: 'pending' | 'verified' | 'rejected' | 'draft' | 'all',
  search?: string
) => {
  const offset = (page - 1) * limit;

  // Base search filter for user name, email, mobile number, or policy number
  // Handle nullable email field properly
  const searchFilter = search && search.trim()
    ? {
        OR: [
          { user: { name: { contains: search.trim() } } },
          { 
            user: {
              AND: [
                { email: { not: null } },
                { email: { contains: search.trim() } }
              ]
            }
          },
          { user: { mobile_number: { contains: search.trim() } } },
          { policy_number: { contains: search.trim() } },
        ],
      }
    : null;

  // Build status conditions
  let statusConditions: any;

  if (status === 'all') {
    // All: Return all policies regardless of status (only exclude inactive users)
    statusConditions = {};
  } else if (status === 'draft') {
    // Draft: Policies with DRAFT status
    statusConditions = {
      status: 'DRAFT',
    };
  } else if (status === 'verified') {
    // Policies that have all documents verified AND have NO unverified documents AND status is PENDING or ACCEPTED
    statusConditions = {
      AND: [
        {
          status: {
            in: ['PENDING', 'ACCEPTED'],
          },
        },
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
    // Rejected: Policies that have ALL documents rejected OR status is REJECTED
    statusConditions = {
      OR: [
        {
          status: 'REJECTED',
        },
        {
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
        },
      ],
    };
  } else {
    // Pending: Policies with PENDING status that have NO verified documents OR have some (but not all) rejected documents
    // Excludes DRAFT status
    statusConditions = {
      AND: [
        {
          status: 'PENDING',
        },
        {
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
        },
      ],
    };
  }

  // Combine status conditions with search filter and exclude inactive users
  const baseConditions: any[] = [
    { user: { subscription_status: { not: 'INACTIVE' } } }, // Exclude policies from inactive users
  ];
  
  // Only add statusConditions if not 'all' (for 'all', we want all statuses)
  if (status !== 'all') {
    baseConditions.push(statusConditions);
  }
  
  if (searchFilter) {
    baseConditions.push(searchFilter);
  }
  
  let whereClause: any = {
    AND: baseConditions,
  };

  try {
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
        policy_nominees: {
          include: {
            nominee: {
              include: {
                documents: true,
              },
            },
          },
        },
      },
      orderBy: { uploaded_at: 'desc' },
      skip: offset,
      take: limit,
    });

    return {
      policies: policies.map((policy) => {
        // Calculate if nominee is verified (has documents and all are verified)
        const nominees = policy.policy_nominees.map((pn) => {
          const nomineeDocs = pn.nominee.documents;
          const isVerified = nomineeDocs.length > 0 && nomineeDocs.every((doc) => doc.is_verified);
          
          return {
            id: pn.id.toString(),
            nominee: {
              id: pn.nominee.id.toString(),
              name: pn.nominee.name,
              relationship: pn.nominee.relationship,
              mobileNumber: pn.nominee.mobile_number,
              email: pn.nominee.email,
              dob: pn.nominee.dob ? pn.nominee.dob.toISOString().split('T')[0] : null,
              address: pn.nominee.address,
              status: pn.nominee.status,
              isVerified,
              documentsCount: nomineeDocs.length,
              verifiedDocumentsCount: nomineeDocs.filter((doc) => doc.is_verified).length,
              documents: nomineeDocs.map((doc) => ({
                id: doc.id.toString(),
                documentType: doc.document_type,
                documentName: doc.document_name,
                documentUrl: doc.document_url,
                isVerified: doc.is_verified,
                uploadedAt: doc.uploaded_at,
                verifiedAt: doc.verified_at,
                rejectedAt: doc.rejected_at,
              })),
            },
            sharePercentage: pn.share_percentage.toString(),
          };
        });

        return {
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
          nominees,
        };
      }),
      pagination: {
        page,
        limit,
        total: totalPolicies,
        totalPages: Math.ceil(totalPolicies / limit) || 1,
      },
    };
  } catch (error) {
    logger.error('Error fetching policy documents', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      page,
      limit,
      status,
      search,
    });
    throw error;
  }
};

export const getNomineeDocuments = async (
  page: number,
  limit: number,
  status: 'pending' | 'verified' | 'rejected' | 'draft' | 'all',
  search?: string
) => {
  const offset = (page - 1) * limit;

  // Base search filter for user name, email, mobile number, or nominee name
  // Handle nullable email field properly
  const searchFilter = search && search.trim()
    ? {
        OR: [
          { user: { name: { contains: search.trim() } } },
          { 
            user: {
              AND: [
                { email: { not: null } },
                { email: { contains: search.trim() } }
              ]
            }
          },
          { user: { mobile_number: { contains: search.trim() } } },
          { name: { contains: search.trim() } },
        ],
      }
    : null;

  // Build status conditions
  let statusConditions: any;

  if (status === 'all') {
    // All: Return all nominees regardless of status (only exclude inactive users)
    statusConditions = {};
  } else if (status === 'draft') {
    // Draft: Nominees with DRAFT status
    statusConditions = {
      status: 'DRAFT',
    };
  } else if (status === 'verified') {
    // Nominees that have all documents verified AND have NO unverified documents AND status is PENDING or ACCEPTED
    statusConditions = {
      AND: [
        {
          status: {
            in: ['PENDING', 'ACCEPTED'],
          },
        },
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
    // Rejected: Nominees that have ALL documents rejected OR status is REJECTED
    statusConditions = {
      OR: [
        {
          status: 'REJECTED',
        },
        {
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
        },
      ],
    };
  } else {
    // Pending: Nominees with PENDING status that don't have all documents verified AND don't have all documents rejected
    // Excludes DRAFT status
    statusConditions = {
      AND: [
        {
          status: 'PENDING',
        },
        {
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
        },
      ],
    };
  }

  // Combine status conditions with search filter and exclude inactive users
  const baseConditions: any[] = [
    { user: { subscription_status: { not: 'INACTIVE' } } }, // Exclude nominees from inactive users
  ];
  
  // Only add statusConditions if not 'all' (for 'all', we want all statuses)
  if (status !== 'all') {
    baseConditions.push(statusConditions);
  }
  
  if (searchFilter) {
    baseConditions.push(searchFilter);
  }
  
  let whereClause: any = {
    AND: baseConditions,
  };

  try {
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
        dob: nominee.dob ? nominee.dob.toISOString().split('T')[0] : null,
        email: nominee.email,
        address: nominee.address,
        status: nominee.status,
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
  } catch (error) {
    logger.error('Error fetching nominee documents', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      page,
      limit,
      status,
      search,
    });
    throw error;
  }
};




/**
 * Delete KYC documents (AADHAAR and PAN) for a user by admin
 * This only deletes KYC documents, not the user account
 */
export const deleteKycDocumentsByAdmin = async (userId: string, adminId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    include: {
      documents: {
        where: {
          document_type: { in: ['AADHAAR', 'PAN'] },
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Delete all KYC document files from filesystem
  const { deleteFile } = await import('../utils/fileUpload');
  const deletedDocuments = [];
  
  for (const document of user.documents) {
    try {
      if (document.document_url) {
        const urlParts = document.document_url.split('/');
        const filename = urlParts[urlParts.length - 1];
        if (filename) {
          deleteFile(filename, 'users');
        }
      }
    } catch (error) {
      logger.warn('Failed to delete KYC document file', {
        documentId: document.id.toString(),
        filename: document.document_url,
        error,
      });
    }
    
    // Delete document from database
    await prisma.userDocument.delete({
      where: { id: document.id },
    });
    
    deletedDocuments.push(document.id.toString());
  }

  logger.info('KYC documents deleted by admin', {
    userId,
    adminId,
    userName: user.name,
    email: user.email,
    documentsDeleted: deletedDocuments.length,
    documentIds: deletedDocuments,
  });

  // Send notification to user
  await sendAdminActionNotification(adminId, userId, 'KYC_DELETED', {
    userName: user.name,
  }).catch((err) => {
    logger.warn('Failed to send KYC deletion notification', { error: err });
  });

  return {
    message: 'KYC documents deleted successfully',
    userId: user.id.toString(),
    documentsDeleted: deletedDocuments.length,
  };
};

/**
 * Delete User account by admin
 * This will cascade delete all related records (policies, nominees, documents, etc.)
 */
export const deleteUserByAdmin = async (userId: string, adminId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    include: {
      documents: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Delete all user document files from filesystem
  const { deleteFile } = await import('../utils/fileUpload');
  for (const document of user.documents) {
    try {
      const urlParts = document.document_url.split('/');
      const filename = urlParts[urlParts.length - 1];
      deleteFile(filename, 'users');
    } catch (error) {
      logger.warn('Failed to delete user document file', {
        documentId: document.id.toString(),
        filename: document.document_url,
        error,
      });
    }
  }

  // Delete user (cascades to policies, nominees, documents, etc.)
  await prisma.user.delete({
    where: { id: BigInt(userId) },
  });

  logger.info('User deleted by admin', {
    userId,
    adminId,
    userName: user.name,
    email: user.email,
  });

  // Send notification (if notification service supports user deletion)
  await sendAdminActionNotification(adminId, userId, 'USER_DELETED', {
    userName: user.name,
  }).catch((err) => {
    logger.warn('Failed to send user deletion notification', { error: err });
  });

  return {
    message: 'User deleted successfully',
    userId: user.id.toString(),
  };
};

/**
 * Delete Policy by admin
 */
export const deletePolicyByAdmin = async (policyId: string, adminId: string) => {
  const policy = await prisma.policy.findUnique({
    where: { id: BigInt(policyId) },
    include: {
      documents: true,
      user: true,
    },
  });

  if (!policy) {
    throw new NotFoundError('Policy not found');
  }

  // Delete all policy document files from filesystem
  const { deleteFile } = await import('../utils/fileUpload');
  for (const document of policy.documents) {
    try {
      const urlParts = document.document_url.split('/');
      const filename = urlParts[urlParts.length - 1];
      deleteFile(filename, 'policies');
    } catch (error) {
      logger.warn('Failed to delete policy document file', {
        documentId: document.id.toString(),
        filename: document.document_url,
        error,
      });
    }
  }

  // Delete policy (cascades to policy documents and policy nominees)
  await prisma.policy.delete({
    where: { id: BigInt(policyId) },
  });

  logger.info('Policy deleted by admin', {
    policyId,
    adminId,
    userId: policy.user_id.toString(),
    policyNumber: policy.policy_number,
  });

  // Send notification to user
  await sendAdminActionNotification(adminId, policy.user_id.toString(), 'POLICY_DELETED', {
    policyNumber: policy.policy_number,
  }).catch((err) => {
    logger.warn('Failed to send policy deletion notification', { error: err });
  });

  return {
    message: 'Policy deleted successfully',
    policyId: policy.id.toString(),
    userId: policy.user_id.toString(),
  };
};

/**
 * Delete Nominee by admin
 */
export const deleteNomineeByAdmin = async (nomineeId: string, adminId: string) => {
  const nominee = await prisma.nominee.findUnique({
    where: { id: BigInt(nomineeId) },
    include: {
      documents: true,
      user: true,
    },
  });

  if (!nominee) {
    throw new NotFoundError('Nominee not found');
  }

  // Delete all nominee document files from filesystem
  const { deleteFile } = await import('../utils/fileUpload');
  for (const document of nominee.documents) {
    try {
      const urlParts = document.document_url.split('/');
      const filename = urlParts[urlParts.length - 1];
      deleteFile(filename, 'nominees');
    } catch (error) {
      logger.warn('Failed to delete nominee document file', {
        documentId: document.id.toString(),
        filename: document.document_url,
        error,
      });
    }
  }

  // Delete nominee (cascades to nominee documents and policy nominees)
  await prisma.nominee.delete({
    where: { id: BigInt(nomineeId) },
  });

  logger.info('Nominee deleted by admin', {
    nomineeId,
    adminId,
    userId: nominee.user_id.toString(),
    nomineeName: nominee.name,
  });

  // Send notification to user
  await sendAdminActionNotification(adminId, nominee.user_id.toString(), 'NOMINEE_DELETED', {
    nomineeName: nominee.name,
  }).catch((err) => {
    logger.warn('Failed to send nominee deletion notification', { error: err });
  });

  return {
    message: 'Nominee deleted successfully',
    nomineeId: nominee.id.toString(),
    userId: nominee.user_id.toString(),
  };
};
