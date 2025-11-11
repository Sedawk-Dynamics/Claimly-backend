import prisma from '../config/prismaClient';
import { NotFoundError, ValidationError } from '../utils/errors';
import { getFileUrl } from '../utils/fileUpload';
import { createActivityLog } from './userActivityLog.service';

export interface UploadUserDocumentData {
  documentType: 'AADHAAR' | 'PAN' | 'OTHER';
  documentName: string;
  filename: string;
}

export const uploadUserDocument = async (userId: string, data: UploadUserDocumentData) => {
  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Validate document type
  const validTypes = ['AADHAAR', 'PAN', 'OTHER'];
  if (!validTypes.includes(data.documentType)) {
    throw new ValidationError(`documentType must be one of: ${validTypes.join(', ')}`);
  }

  // Generate file URL
  const documentUrl = getFileUrl(data.filename, 'users');

  const document = await prisma.userDocument.create({
    data: {
      user_id: BigInt(userId),
      document_type: data.documentType,
      document_name: data.documentName,
      document_url: documentUrl,
      is_verified: false,
    },
  });

  // Log activity
  await createActivityLog({
    userId,
    activityType: 'DOCUMENT_UPLOADED',
    description: `Uploaded ${data.documentType} document: ${data.documentName}`,
    metadata: {
      documentId: document.id.toString(),
      documentType: data.documentType,
      documentName: data.documentName,
    },
  }).catch((err) => {
    // Don't fail the request if logging fails
    console.error('Failed to log activity:', err);
  });

  return {
    id: document.id.toString(),
    userId: document.user_id.toString(),
    documentType: document.document_type,
    documentName: document.document_name,
    documentUrl: document.document_url,
    isVerified: document.is_verified,
    uploadedAt: document.uploaded_at,
    verifiedAt: document.verified_at,
  };
};

export const getUserDocuments = async (userId: string) => {
  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const documents = await prisma.userDocument.findMany({
    where: { user_id: BigInt(userId) },
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

export const getUserDocumentById = async (userId: string, documentId: string) => {
  const document = await prisma.userDocument.findFirst({
    where: {
      id: BigInt(documentId),
      user_id: BigInt(userId),
    },
  });

  if (!document) {
    throw new NotFoundError('Document not found');
  }

  return {
    id: document.id.toString(),
    userId: document.user_id.toString(),
    documentType: document.document_type,
    documentName: document.document_name,
    documentUrl: document.document_url,
    isVerified: document.is_verified,
    uploadedAt: document.uploaded_at,
    verifiedAt: document.verified_at,
  };
};

export const updateUserDocument = async (
  userId: string,
  documentId: string,
  data: UploadUserDocumentData
) => {
  // Verify document exists and belongs to user
  const existingDocument = await prisma.userDocument.findFirst({
    where: {
      id: BigInt(documentId),
      user_id: BigInt(userId),
    },
  });

  if (!existingDocument) {
    throw new NotFoundError('Document not found');
  }

  // Validate document type
  const validTypes = ['AADHAAR', 'PAN', 'OTHER'];
  if (!validTypes.includes(data.documentType)) {
    throw new ValidationError(`documentType must be one of: ${validTypes.join(', ')}`);
  }

  // Delete old file from filesystem
  const urlParts = existingDocument.document_url.split('/');
  const oldFilename = urlParts[urlParts.length - 1];
  const { deleteFile } = await import('../utils/fileUpload');
  deleteFile(oldFilename, 'users');

  // Generate new file URL
  const documentUrl = getFileUrl(data.filename, 'users');

  // Update document with new file and reset verification
  // Preserve verified_at if it exists (indicates re-verification needed)
  const updatedDocument = await prisma.userDocument.update({
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

  // Log activity
  await createActivityLog({
    userId,
    activityType: 'DOCUMENT_UPDATED',
    description: `Updated ${data.documentType} document: ${data.documentName}`,
    metadata: {
      documentId: updatedDocument.id.toString(),
      documentType: data.documentType,
      documentName: data.documentName,
    },
  }).catch((err) => {
    // Don't fail the request if logging fails
    console.error('Failed to log activity:', err);
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

export const deleteUserDocument = async (userId: string, documentId: string) => {
  const document = await prisma.userDocument.findFirst({
    where: {
      id: BigInt(documentId),
      user_id: BigInt(userId),
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
  deleteFile(filename, 'users');

  // Delete from database
  await prisma.userDocument.delete({
    where: { id: BigInt(documentId) },
  });

  return { message: 'Document deleted successfully' };
};

