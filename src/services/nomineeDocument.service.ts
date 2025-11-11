import prisma from '../config/prismaClient';
import { NotFoundError, ValidationError } from '../utils/errors';
import { getFileUrl } from '../utils/fileUpload';
import { createActivityLog } from './userActivityLog.service';

export interface UploadNomineeDocumentData {
  documentType: 'NOMINEE_ID' | 'ADDRESS_PROOF' | 'DEATH_CERTIFICATE' | 'OTHER';
  documentName: string;
  filename: string;
}

export const uploadNomineeDocument = async (userId: string, nomineeId: string, data: UploadNomineeDocumentData) => {
  // Verify nominee exists and belongs to user
  const nominee = await prisma.nominee.findFirst({
    where: {
      id: BigInt(nomineeId),
      user_id: BigInt(userId),
    },
  });

  if (!nominee) {
    throw new NotFoundError('Nominee not found');
  }

  // Validate document type
  const validTypes = ['NOMINEE_ID', 'ADDRESS_PROOF', 'DEATH_CERTIFICATE', 'OTHER'];
  if (!validTypes.includes(data.documentType)) {
    throw new ValidationError(`documentType must be one of: ${validTypes.join(', ')}`);
  }

  // Generate file URL
  const documentUrl = getFileUrl(data.filename, 'nominees');

  const document = await prisma.nomineeDocument.create({
    data: {
      nominee_id: BigInt(nomineeId),
      document_type: data.documentType,
      document_name: data.documentName,
      document_url: documentUrl,
      is_verified: false,
    },
  });

  // Log activity
  await createActivityLog({
    userId,
    activityType: 'NOMINEE_DOCUMENT_UPLOADED',
    description: `Uploaded ${data.documentType} document for nominee ${nominee.name}: ${data.documentName}`,
    metadata: {
      documentId: document.id.toString(),
      nomineeId,
      nomineeName: nominee.name,
      documentType: data.documentType,
      documentName: data.documentName,
    },
  }).catch((err) => {
    // Don't fail the request if logging fails
    console.error('Failed to log activity:', err);
  });

  return {
    id: document.id.toString(),
    nomineeId: document.nominee_id.toString(),
    documentType: document.document_type,
    documentName: document.document_name,
    documentUrl: document.document_url,
    isVerified: document.is_verified,
    uploadedAt: document.uploaded_at,
    verifiedAt: document.verified_at,
  };
};

export const getNomineeDocuments = async (userId: string, nomineeId: string) => {
  // Verify nominee exists and belongs to user
  const nominee = await prisma.nominee.findFirst({
    where: {
      id: BigInt(nomineeId),
      user_id: BigInt(userId),
    },
  });

  if (!nominee) {
    throw new NotFoundError('Nominee not found');
  }

  const documents = await prisma.nomineeDocument.findMany({
    where: { nominee_id: BigInt(nomineeId) },
    orderBy: { uploaded_at: 'desc' },
  });

  return documents.map((doc) => ({
    id: doc.id.toString(),
    documentType: doc.document_type,
    documentName: doc.document_name,
    documentUrl: doc.document_url,
    isVerified: doc.is_verified,
    uploadedAt: doc.uploaded_at,
    verifiedAt: doc.verified_at,
  }));
};

export const getNomineeDocumentById = async (userId: string, nomineeId: string, documentId: string) => {
  // Verify nominee exists and belongs to user
  const nominee = await prisma.nominee.findFirst({
    where: {
      id: BigInt(nomineeId),
      user_id: BigInt(userId),
    },
  });

  if (!nominee) {
    throw new NotFoundError('Nominee not found');
  }

  const document = await prisma.nomineeDocument.findFirst({
    where: {
      id: BigInt(documentId),
      nominee_id: BigInt(nomineeId),
    },
  });

  if (!document) {
    throw new NotFoundError('Document not found');
  }

  return {
    id: document.id.toString(),
    nomineeId: document.nominee_id.toString(),
    documentType: document.document_type,
    documentName: document.document_name,
    documentUrl: document.document_url,
    isVerified: document.is_verified,
    uploadedAt: document.uploaded_at,
    verifiedAt: document.verified_at,
  };
};

export const updateNomineeDocument = async (
  userId: string,
  nomineeId: string,
  documentId: string,
  data: UploadNomineeDocumentData
) => {
  // Verify nominee exists and belongs to user
  const nominee = await prisma.nominee.findFirst({
    where: {
      id: BigInt(nomineeId),
      user_id: BigInt(userId),
    },
  });

  if (!nominee) {
    throw new NotFoundError('Nominee not found');
  }

  // Verify document exists and belongs to nominee
  const existingDocument = await prisma.nomineeDocument.findFirst({
    where: {
      id: BigInt(documentId),
      nominee_id: BigInt(nomineeId),
    },
  });

  if (!existingDocument) {
    throw new NotFoundError('Document not found');
  }

  // Validate document type
  const validTypes = ['NOMINEE_ID', 'ADDRESS_PROOF', 'DEATH_CERTIFICATE', 'OTHER'];
  if (!validTypes.includes(data.documentType)) {
    throw new ValidationError(`documentType must be one of: ${validTypes.join(', ')}`);
  }

  // Delete old file from filesystem
  const urlParts = existingDocument.document_url.split('/');
  const oldFilename = urlParts[urlParts.length - 1];
  const { deleteFile } = await import('../utils/fileUpload');
  deleteFile(oldFilename, 'nominees');

  // Generate new file URL
  const documentUrl = getFileUrl(data.filename, 'nominees');

  // Update document with new file and reset verification
  // Preserve verified_at if it exists (indicates re-verification needed)
  const updatedDocument = await prisma.nomineeDocument.update({
    where: { id: BigInt(documentId) },
    data: {
      document_type: data.documentType,
      document_name: data.documentName,
      document_url: documentUrl,
      is_verified: false,
      // Keep verified_at if it exists (was previously verified, now needs re-verification)
      // Only set to null if it was never verified
      uploaded_at: new Date(),
    },
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

export const deleteNomineeDocument = async (userId: string, nomineeId: string, documentId: string) => {
  // Verify nominee exists and belongs to user
  const nominee = await prisma.nominee.findFirst({
    where: {
      id: BigInt(nomineeId),
      user_id: BigInt(userId),
    },
  });

  if (!nominee) {
    throw new NotFoundError('Nominee not found');
  }

  const document = await prisma.nomineeDocument.findFirst({
    where: {
      id: BigInt(documentId),
      nominee_id: BigInt(nomineeId),
    },
  });

  if (!document) {
    throw new NotFoundError('Document not found');
  }

  // Extract filename from URL
  const urlParts = document.document_url.split('/');
  const filename = urlParts[urlParts.length - 1];

  // Delete file from filesystem
  const { deleteFile } = await import('../utils/fileUpload');
  deleteFile(filename, 'nominees');

  // Delete from database
  await prisma.nomineeDocument.delete({
    where: { id: BigInt(documentId) },
  });

  return { message: 'Document deleted successfully' };
};

