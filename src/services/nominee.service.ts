import prisma from '../config/prismaClient';
import { NotFoundError, ValidationError } from '../utils/errors';
import { createActivityLog } from './userActivityLog.service';
import { getFileUrl } from '../utils/fileUpload';
import { updatePolicyStatusBasedOnCompleteness } from './policy.service';
import logger from '../config/logger';

/**
 * Helper function to check if a nominee is complete (all required fields and documents filled)
 * Returns true if complete, false otherwise
 */
const isNomineeComplete = async (nomineeId: bigint): Promise<boolean> => {
  const nominee = await prisma.nominee.findUnique({
    where: { id: nomineeId },
    include: {
      documents: true,
    },
  });

  if (!nominee) {
    return false;
  }

  // Check required nominee fields: name, relationship, mobile_number, dob
  const hasRequiredFields = 
    !!nominee.name &&
    !!nominee.relationship &&
    !!nominee.mobile_number &&
    !!nominee.dob;

  if (!hasRequiredFields) {
    return false;
  }

  // Check if at least one document is uploaded
  const hasDocuments = nominee.documents.length > 0;

  if (!hasDocuments) {
    return false;
  }

  return true;
};

/**
 * Helper function to update nominee status based on completeness
 * Only updates status for DRAFT and PENDING nominees, never for ACCEPTED or REJECTED
 */
export const updateNomineeStatusBasedOnCompleteness = async (nomineeId: string): Promise<void> => {
  const nomineeIdBigInt = BigInt(nomineeId);
  
  // Get current nominee status
  const nominee = await prisma.nominee.findUnique({
    where: { id: nomineeIdBigInt },
    select: { id: true, status: true },
  });

  if (!nominee) {
    return;
  }

  // Only auto-update status for DRAFT and PENDING nominees
  // Never change ACCEPTED or REJECTED statuses
  if (nominee.status !== 'DRAFT' && nominee.status !== 'PENDING') {
    return;
  }

  const isComplete = await isNomineeComplete(nomineeIdBigInt);

  if (isComplete && nominee.status === 'DRAFT') {
    // Move from DRAFT to PENDING when complete
    await prisma.nominee.update({
      where: { id: nomineeIdBigInt },
      data: { status: 'PENDING' },
    });
    logger.info('Nominee status updated to PENDING (completed)', {
      nomineeId,
    });
  } else if (!isComplete && nominee.status === 'PENDING') {
    // Move from PENDING to DRAFT when incomplete
    await prisma.nominee.update({
      where: { id: nomineeIdBigInt },
      data: { status: 'DRAFT' },
    });
    logger.info('Nominee status updated to DRAFT (incomplete)', {
      nomineeId,
    });
  }
};

export interface CreateNomineeData {
  name: string;
  relationship: 'SPOUSE' | 'CHILD' | 'PARENT' | 'SIBLING' | 'FRIEND' | 'OTHER';
  mobileNumber: string;
  dob: string;
  email?: string;
  address?: string;
}

export interface CreateNomineeDraftData {
  name: string;
  relationship?: 'SPOUSE' | 'CHILD' | 'PARENT' | 'SIBLING' | 'FRIEND' | 'OTHER';
  mobileNumber?: string;
  dob?: string;
  email?: string;
  address?: string;
}

export interface DocumentToAdd {
  documentType: 'NOMINEE_ID' | 'ADDRESS_PROOF' | 'OTHER';
  documentName: string;
  filename: string;
}

export interface DocumentToUpdate {
  documentId: string;
  documentType: 'NOMINEE_ID' | 'ADDRESS_PROOF' | 'OTHER';
  documentName: string;
  filename: string;
}

export interface UpdateNomineeData {
  name?: string;
  relationship?: 'SPOUSE' | 'CHILD' | 'PARENT' | 'SIBLING' | 'FRIEND' | 'OTHER';
  mobileNumber?: string;
  dob?: string;
  email?: string;
  address?: string;
  documentsToAdd?: DocumentToAdd[];
  documentsToUpdate?: DocumentToUpdate[];
  documentsToDelete?: string[];
}

export const markNomineeAsDraft = async (userId: string, nomineeId: string) => {
  const nominee = await prisma.nominee.findFirst({
    where: {
      id: BigInt(nomineeId),
      user_id: BigInt(userId),
    },
  });

  if (!nominee) {
    throw new NotFoundError('Nominee not found');
  }

  const updated = await prisma.nominee.update({
    where: { id: BigInt(nomineeId) },
    data: { status: 'DRAFT' },
  });

  return {
    id: updated.id.toString(),
    status: updated.status,
    updatedAt: updated.updated_at,
  };
};
const parseDob = (dob?: string) => {
  if (!dob) {
    return null;
  }

  const parsed = new Date(`${dob}T00:00:00.000Z`);
  if (isNaN(parsed.getTime())) {
    throw new ValidationError('Invalid date of birth');
  }

  return parsed;
};

export const createNominee = async (userId: string, data: CreateNomineeData) => {
  // Validate mobile number format
  const mobileRegex = /^[0-9]{10}$/;
  if (!mobileRegex.test(data.mobileNumber.replace(/[^0-9]/g, ''))) {
    throw new ValidationError('Invalid mobile number format');
  }

  // Validate email if provided
  if (data.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new ValidationError('Invalid email format');
    }
  }

  const dobDate = parseDob(data.dob);

  const nominee = await prisma.nominee.create({
    data: {
      user_id: BigInt(userId),
      name: data.name,
      relationship: data.relationship,
      mobile_number: data.mobileNumber,
      dob: dobDate,
      email: data.email || null,
      address: data.address || null,
      status: 'DRAFT', // New nominees start as DRAFT
    },
    include: {
      policy_links: {
        include: {
          policy: {
            select: {
              id: true,
              policy_number: true,
              sum_assured: true,
            },
          },
        },
      },
      documents: {
        select: {
          id: true,
          document_type: true,
          document_name: true,
          document_url: true,
          is_verified: true,
          uploaded_at: true,
          verified_at: true,
          rejected_at: true,
        },
      },
    },
  });

  // Log activity
  await createActivityLog({
    userId,
    activityType: 'NOMINEE_ADDED',
    description: `Added nominee: ${data.name} (${data.relationship})`,
    metadata: {
      nomineeId: nominee.id.toString(),
      nomineeName: data.name,
      relationship: data.relationship,
      mobileNumber: data.mobileNumber,
    },
  }).catch((err) => {
    // Don't fail the request if logging fails
    console.error('Failed to log activity:', err);
  });

  // Alert creation removed - alerts now only come from mobile app SMS reading

  // Check and update status based on completeness
  await updateNomineeStatusBasedOnCompleteness(nominee.id.toString()).catch((err) => {
    // Don't fail the request if status update fails
    logger.error('Failed to update nominee status based on completeness', {
      nomineeId: nominee.id.toString(),
      error: err,
    });
  });

  // Fetch the nominee again to get the updated status
  const nomineeWithStatus = await prisma.nominee.findUnique({
    where: { id: nominee.id },
    select: { status: true },
  });

  return {
    id: nominee.id.toString(),
    name: nominee.name,
    relationship: nominee.relationship,
    mobileNumber: nominee.mobile_number,
    dob: nominee.dob ? nominee.dob.toISOString().split('T')[0] : null,
    email: nominee.email,
    address: nominee.address,
    status: nomineeWithStatus?.status || nominee.status,
    createdAt: nominee.created_at,
    updatedAt: nominee.updated_at,
    policies: nominee.policy_links.map((link) => ({
      policyId: link.policy.id.toString(),
      policyNumber: link.policy.policy_number,
      sumAssured: link.policy.sum_assured.toString(),
      sharePercentage: link.share_percentage.toString(),
    })),
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
  };
};

export const createNomineeDraft = async (userId: string, data: CreateNomineeDraftData) => {
  const mobileRegex = /^[0-9]{10}$/;

  const trimmedName = data.name?.trim();
  if (!trimmedName) {
    throw new ValidationError('Name is required to save a nominee draft');
  }

  const mobileNumber =
    data.mobileNumber && data.mobileNumber !== ''
      ? data.mobileNumber.replace(/[^0-9]/g, '')
      : '';

  if (mobileNumber && !mobileRegex.test(mobileNumber)) {
    throw new ValidationError('Invalid mobile number format');
  }

  if (data.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new ValidationError('Invalid email format');
    }
  }

  const dobDate = parseDob(data.dob);

  const nominee = await prisma.nominee.create({
    data: {
      user_id: BigInt(userId),
      name: trimmedName,
      relationship: data.relationship || 'OTHER',
      mobile_number: mobileNumber,
      dob: dobDate,
      email: data.email || null,
      address: data.address || null,
      status: 'DRAFT',
    },
    include: {
      policy_links: {
        include: {
          policy: {
            select: {
              id: true,
              policy_number: true,
              sum_assured: true,
            },
          },
        },
      },
      documents: {
        select: {
          id: true,
          document_type: true,
          document_name: true,
          document_url: true,
          is_verified: true,
          uploaded_at: true,
          verified_at: true,
          rejected_at: true,
        },
      },
    },
  });

  await createActivityLog({
    userId,
    activityType: 'NOMINEE_DRAFT_SAVED',
    description: `Saved nominee draft: ${trimmedName}`,
    metadata: {
      nomineeId: nominee.id.toString(),
      nomineeName: trimmedName,
      relationship: data.relationship || 'OTHER',
    },
  }).catch((err) => {
    console.error('Failed to log draft nominee activity:', err);
  });

  await updateNomineeStatusBasedOnCompleteness(nominee.id.toString()).catch((err) => {
    logger.error('Failed to update nominee status based on completeness', {
      nomineeId: nominee.id.toString(),
      error: err,
    });
  });

  const nomineeWithStatus = await prisma.nominee.findUnique({
    where: { id: nominee.id },
    select: { status: true },
  });

  return {
    id: nominee.id.toString(),
    name: nominee.name,
    relationship: nominee.relationship,
    mobileNumber: nominee.mobile_number,
    dob: nominee.dob ? nominee.dob.toISOString().split('T')[0] : null,
    email: nominee.email,
    address: nominee.address,
    status: nomineeWithStatus?.status || nominee.status,
    createdAt: nominee.created_at,
    updatedAt: nominee.updated_at,
    policies: nominee.policy_links.map((link) => ({
      policyId: link.policy.id.toString(),
      policyNumber: link.policy.policy_number,
      sumAssured: link.policy.sum_assured.toString(),
      sharePercentage: link.share_percentage.toString(),
    })),
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
  };
};

export const getUserNominees = async (userId: string) => {
  const nominees = await prisma.nominee.findMany({
    where: { user_id: BigInt(userId) },
    include: {
      policy_links: {
        include: {
          policy: {
            select: {
              id: true,
              policy_number: true,
              sum_assured: true,
            },
          },
        },
      },
      documents: {
        select: {
          id: true,
          document_type: true,
          document_name: true,
          document_url: true,
          is_verified: true,
          uploaded_at: true,
          verified_at: true,
          rejected_at: true,
        },
        orderBy: {
          uploaded_at: 'desc',
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  return nominees.map((nominee) => ({
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
    policies: nominee.policy_links.map((link) => ({
      policyId: link.policy.id.toString(),
      policyNumber: link.policy.policy_number,
      sumAssured: link.policy.sum_assured.toString(),
      sharePercentage: link.share_percentage.toString(),
    })),
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
    documentsCount: nominee.documents.length,
    verifiedDocumentsCount: nominee.documents.filter((d) => d.is_verified).length,
    isVerified: nominee.documents.length > 0 && nominee.documents.every((d) => d.is_verified),
  }));
};

export const getNomineeById = async (userId: string, nomineeId: string) => {
  const nominee = await prisma.nominee.findFirst({
    where: {
      id: BigInt(nomineeId),
      user_id: BigInt(userId),
    },
    include: {
      policy_links: {
        include: {
          policy: {
            select: {
              id: true,
              policy_number: true,
              sum_assured: true,
              status: true,
            },
          },
        },
      },
      documents: true,
    },
  });

  if (!nominee) {
    throw new NotFoundError('Nominee not found');
  }

  return {
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
    policies: nominee.policy_links.map((link) => ({
      id: link.id.toString(),
      policyId: link.policy.id.toString(),
      policyNumber: link.policy.policy_number,
      sumAssured: link.policy.sum_assured.toString(),
      status: link.policy.status,
      sharePercentage: link.share_percentage.toString(),
      createdAt: link.created_at,
    })),
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
  };
};

export const updateNominee = async (userId: string, nomineeId: string, data: UpdateNomineeData) => {
  // Verify nominee exists and belongs to user
  const existingNominee = await prisma.nominee.findFirst({
    where: {
      id: BigInt(nomineeId),
      user_id: BigInt(userId),
    },
    include: {
      documents: true,
      policy_links: {
        select: {
          policy_id: true,
        },
      },
    },
  });

  if (!existingNominee) {
    throw new NotFoundError('Nominee not found');
  }

  // Get list of policy IDs linked to this nominee (to update their status later)
  const linkedPolicyIds = existingNominee.policy_links.map((link) => link.policy_id.toString());

  // Validate mobile number if being updated
  if (data.mobileNumber) {
    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(data.mobileNumber.replace(/[^0-9]/g, ''))) {
      throw new ValidationError('Invalid mobile number format');
    }
  }

  // Validate email if being updated
  if (data.email !== undefined && data.email !== null) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (data.email && !emailRegex.test(data.email)) {
      throw new ValidationError('Invalid email format');
    }
  }

  // Validate document types
  const validDocumentTypes = ['NOMINEE_ID', 'ADDRESS_PROOF', 'OTHER'];
  
  if (data.documentsToAdd) {
    for (const doc of data.documentsToAdd) {
      if (!validDocumentTypes.includes(doc.documentType)) {
        throw new ValidationError(`Invalid document type: ${doc.documentType}`);
      }
    }
  }

  if (data.documentsToUpdate) {
    for (const doc of data.documentsToUpdate) {
      if (!validDocumentTypes.includes(doc.documentType)) {
        throw new ValidationError(`Invalid document type: ${doc.documentType}`);
      }
    }
  }

  // Update nominee basic fields
  const updateData: any = {};
  if (data.name) updateData.name = data.name;
  if (data.relationship) updateData.relationship = data.relationship;
  if (data.mobileNumber) updateData.mobile_number = data.mobileNumber;
  if (data.email !== undefined) updateData.email = data.email || null;
  if (data.address !== undefined) updateData.address = data.address || null;
  if (data.dob !== undefined) updateData.dob = data.dob ? parseDob(data.dob) : null;

  const updatedNominee = await prisma.nominee.update({
    where: { id: BigInt(nomineeId) },
    data: updateData,
  });

  // Handle document deletions
  if (data.documentsToDelete && data.documentsToDelete.length > 0) {
    for (const documentId of data.documentsToDelete) {
      const document = await prisma.nomineeDocument.findFirst({
        where: {
          id: BigInt(documentId),
          nominee_id: BigInt(nomineeId),
        },
      });

      if (document) {
        // Delete file from filesystem
        const { deleteFile } = await import('../utils/fileUpload');
        const urlParts = document.document_url.split('/');
        const filename = urlParts[urlParts.length - 1];
        deleteFile(filename, 'nominees');

        // Delete from database
        await prisma.nomineeDocument.delete({
          where: { id: BigInt(documentId) },
        });
      }
    }
  }

  // Handle document updates
  if (data.documentsToUpdate && data.documentsToUpdate.length > 0) {
    for (const docUpdate of data.documentsToUpdate) {
      const existingDocument = await prisma.nomineeDocument.findFirst({
        where: {
          id: BigInt(docUpdate.documentId),
          nominee_id: BigInt(nomineeId),
        },
      });

      if (!existingDocument) {
        throw new NotFoundError(`Document not found: ${docUpdate.documentId}`);
      }

      // Delete old file from filesystem
      const { deleteFile } = await import('../utils/fileUpload');
      const urlParts = existingDocument.document_url.split('/');
      const oldFilename = urlParts[urlParts.length - 1];
      deleteFile(oldFilename, 'nominees');

      // Generate new file URL
      const documentUrl = getFileUrl(docUpdate.filename, 'nominees');

      // Update document
      await prisma.nomineeDocument.update({
        where: { id: BigInt(docUpdate.documentId) },
        data: {
          document_type: docUpdate.documentType,
          document_name: docUpdate.documentName,
          document_url: documentUrl,
          is_verified: false,
          uploaded_at: new Date(),
        },
      });
    }
  }

  // Handle document additions
  if (data.documentsToAdd && data.documentsToAdd.length > 0) {
    for (const docAdd of data.documentsToAdd) {
      const documentUrl = getFileUrl(docAdd.filename, 'nominees');

      await prisma.nomineeDocument.create({
        data: {
          nominee_id: BigInt(nomineeId),
          document_type: docAdd.documentType,
          document_name: docAdd.documentName,
          document_url: documentUrl,
          is_verified: false,
        },
      });
    }
  }

  // Fetch updated nominee with documents
  const nomineeWithDocs = await prisma.nominee.findUnique({
    where: { id: BigInt(nomineeId) },
    include: {
      documents: {
        orderBy: { uploaded_at: 'desc' },
      },
    },
  });

  // Log activity
  const activityFields = Object.keys(updateData);
  if (data.documentsToAdd?.length) activityFields.push(`added ${data.documentsToAdd.length} document(s)`);
  if (data.documentsToUpdate?.length) activityFields.push(`updated ${data.documentsToUpdate.length} document(s)`);
  if (data.documentsToDelete?.length) activityFields.push(`deleted ${data.documentsToDelete.length} document(s)`);

  await createActivityLog({
    userId,
    activityType: 'NOMINEE_UPDATED',
    description: `Updated nominee: ${updatedNominee.name}`,
    metadata: {
      nomineeId: updatedNominee.id.toString(),
      nomineeName: updatedNominee.name,
      updatedFields: activityFields,
    },
  }).catch((err) => {
    // Don't fail the request if logging fails
    console.error('Failed to log activity:', err);
  });

  // Check and update status of all policies linked to this nominee
  // This ensures that if nominee details changed, policies that depend on those details are re-evaluated
  for (const policyId of linkedPolicyIds) {
    await updatePolicyStatusBasedOnCompleteness(policyId).catch((err) => {
      // Don't fail the request if status update fails
      console.error(`Failed to update policy status for policy ${policyId}:`, err);
    });
  }

  // Check and update nominee status based on completeness
  await updateNomineeStatusBasedOnCompleteness(nomineeId).catch((err) => {
    // Don't fail the request if status update fails
    logger.error('Failed to update nominee status based on completeness', {
      nomineeId,
      error: err,
    });
  });

  // Fetch the nominee again to get the updated status
  const nomineeWithStatus = await prisma.nominee.findUnique({
    where: { id: BigInt(nomineeId) },
    select: { status: true },
  });

  return {
    id: updatedNominee.id.toString(),
    name: updatedNominee.name,
    relationship: updatedNominee.relationship,
    mobileNumber: updatedNominee.mobile_number,
    dob: updatedNominee.dob ? updatedNominee.dob.toISOString().split('T')[0] : null,
    email: updatedNominee.email,
    address: updatedNominee.address,
    status: nomineeWithStatus?.status || updatedNominee.status,
    createdAt: updatedNominee.created_at,
    updatedAt: updatedNominee.updated_at,
    documents: nomineeWithDocs?.documents.map((doc) => ({
      id: doc.id.toString(),
      documentType: doc.document_type,
      documentName: doc.document_name,
      documentUrl: doc.document_url,
      isVerified: doc.is_verified,
      uploadedAt: doc.uploaded_at,
      verifiedAt: doc.verified_at,
    })) || [],
  };
};

export const deleteNominee = async (userId: string, nomineeId: string) => {
  const nominee = await prisma.nominee.findFirst({
    where: {
      id: BigInt(nomineeId),
      user_id: BigInt(userId),
    },
  });

  if (!nominee) {
    throw new NotFoundError('Nominee not found');
  }

  await prisma.nominee.delete({
    where: { id: BigInt(nomineeId) },
  });

  return { message: 'Nominee deleted successfully' };
};

