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

export const getKycDocuments = async (
  page: number,
  limit: number,
  status: 'pending' | 'verified'
) => {
  const offset = (page - 1) * limit;
  const documentTypes: UserDocumentType[] = ['AADHAAR', 'PAN'];
  const hasAllVerified = status === 'verified';

  const totalUsers = await prisma.user.count({
    where: {
      documents: {
        some: {
          document_type: { in: documentTypes },
          ...(hasAllVerified ? { is_verified: true } : {}),
        },
      },
    },
  });

  const users = await prisma.user.findMany({
    where: {
      documents: {
        some: {
          document_type: { in: documentTypes },
          ...(hasAllVerified ? { is_verified: true } : {}),
        },
      },
    },
    include: {
      documents: {
        where: {
          document_type: { in: documentTypes },
          ...(hasAllVerified ? { is_verified: true } : {}),
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


