import prisma from '../config/prismaClient';
import { NotFoundError, ValidationError } from '../utils/errors';
import { getFileUrl } from '../utils/fileUpload';

export interface UploadPolicyDocumentData {
  documentType: 'POLICY_COPY' | 'RECEIPT' | 'OTHER';
  documentName: string;
  filename: string;
}

export const uploadPolicyDocument = async (
  userId: string,
  policyId: string,
  data: UploadPolicyDocumentData
) => {
  // Verify policy exists and belongs to user
  const policy = await prisma.policy.findFirst({
    where: {
      id: BigInt(policyId),
      user_id: BigInt(userId),
    },
  });

  if (!policy) {
    throw new NotFoundError('Policy not found');
  }

  // Validate document name
  if (!data.documentName || data.documentName.trim().length === 0) {
    throw new ValidationError('Document name is required');
  }

  // Generate file URL
  const documentUrl = getFileUrl(data.filename, 'policies');

  const document = await prisma.policyDocument.create({
    data: {
      policy_id: BigInt(policyId),
      document_type: data.documentType,
      document_name: data.documentName,
      document_url: documentUrl,
      is_verified: false,
    },
  });

  return {
    id: document.id.toString(),
    policyId: document.policy_id.toString(),
    documentType: document.document_type,
    documentName: document.document_name,
    documentUrl: document.document_url,
    isVerified: document.is_verified,
    uploadedAt: document.uploaded_at,
    verifiedAt: document.verified_at,
  };
};

export const getPolicyDocuments = async (userId: string, policyId: string) => {
  // Verify policy exists and belongs to user
  const policy = await prisma.policy.findFirst({
    where: {
      id: BigInt(policyId),
      user_id: BigInt(userId),
    },
  });

  if (!policy) {
    throw new NotFoundError('Policy not found');
  }

  const documents = await prisma.policyDocument.findMany({
    where: { policy_id: BigInt(policyId) },
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

export const getPolicyDocumentById = async (
  userId: string,
  policyId: string,
  documentId: string
) => {
  // Verify policy exists and belongs to user
  const policy = await prisma.policy.findFirst({
    where: {
      id: BigInt(policyId),
      user_id: BigInt(userId),
    },
  });

  if (!policy) {
    throw new NotFoundError('Policy not found');
  }

  const document = await prisma.policyDocument.findFirst({
    where: {
      id: BigInt(documentId),
      policy_id: BigInt(policyId),
    },
  });

  if (!document) {
    throw new NotFoundError('Document not found');
  }

  return {
    id: document.id.toString(),
    policyId: document.policy_id.toString(),
    documentType: document.document_type,
    documentName: document.document_name,
    documentUrl: document.document_url,
    isVerified: document.is_verified,
    uploadedAt: document.uploaded_at,
    verifiedAt: document.verified_at,
  };
};

export const deletePolicyDocument = async (
  userId: string,
  policyId: string,
  documentId: string
) => {
  // Verify policy exists and belongs to user
  const policy = await prisma.policy.findFirst({
    where: {
      id: BigInt(policyId),
      user_id: BigInt(userId),
    },
  });

  if (!policy) {
    throw new NotFoundError('Policy not found');
  }

  const document = await prisma.policyDocument.findFirst({
    where: {
      id: BigInt(documentId),
      policy_id: BigInt(policyId),
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
  deleteFile(filename, 'policies');

  // Delete from database
  await prisma.policyDocument.delete({
    where: { id: BigInt(documentId) },
  });

  return { message: 'Document deleted successfully' };
};

