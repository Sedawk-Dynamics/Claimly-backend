import prisma from '../config/prismaClient';
import { NotFoundError, ValidationError } from '../utils/errors';
import { getFileUrl } from '../utils/fileUpload';

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

