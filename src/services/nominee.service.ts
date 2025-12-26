import prisma from '../config/prismaClient';
import { NotFoundError, ValidationError } from '../utils/errors';
import { createActivityLog } from './userActivityLog.service';
import { getFileUrl } from '../utils/fileUpload';

export interface CreateNomineeData {
  name: string;
  relationship: 'SPOUSE' | 'CHILD' | 'PARENT' | 'SIBLING' | 'FRIEND' | 'OTHER';
  mobileNumber: string;
  dob: string;
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

  return {
    id: nominee.id.toString(),
    name: nominee.name,
    relationship: nominee.relationship,
    mobileNumber: nominee.mobile_number,
    dob: nominee.dob ? nominee.dob.toISOString().split('T')[0] : null,
    email: nominee.email,
    address: nominee.address,
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
    },
  });

  if (!existingNominee) {
    throw new NotFoundError('Nominee not found');
  }

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

  return {
    id: updatedNominee.id.toString(),
    name: updatedNominee.name,
    relationship: updatedNominee.relationship,
    mobileNumber: updatedNominee.mobile_number,
    dob: updatedNominee.dob ? updatedNominee.dob.toISOString().split('T')[0] : null,
    email: updatedNominee.email,
    address: updatedNominee.address,
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

