import prisma from '../config/prismaClient';
import { NotFoundError, ValidationError } from '../utils/errors';

export interface CreateNomineeData {
  name: string;
  relationship: 'SPOUSE' | 'CHILD' | 'PARENT' | 'SIBLING' | 'FRIEND' | 'OTHER';
  mobileNumber: string;
  email?: string;
  address?: string;
}

export interface UpdateNomineeData {
  name?: string;
  relationship?: 'SPOUSE' | 'CHILD' | 'PARENT' | 'SIBLING' | 'FRIEND' | 'OTHER';
  mobileNumber?: string;
  email?: string;
  address?: string;
}

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

  const nominee = await prisma.nominee.create({
    data: {
      user_id: BigInt(userId),
      name: data.name,
      relationship: data.relationship,
      mobile_number: data.mobileNumber,
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

  return {
    id: nominee.id.toString(),
    name: nominee.name,
    relationship: nominee.relationship,
    mobileNumber: nominee.mobile_number,
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
          is_verified: true,
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
    documentsCount: nominee.documents.length,
    verifiedDocumentsCount: nominee.documents.filter((d) => d.is_verified).length,
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

  const updateData: any = {};
  if (data.name) updateData.name = data.name;
  if (data.relationship) updateData.relationship = data.relationship;
  if (data.mobileNumber) updateData.mobile_number = data.mobileNumber;
  if (data.email !== undefined) updateData.email = data.email || null;
  if (data.address !== undefined) updateData.address = data.address || null;

  const updatedNominee = await prisma.nominee.update({
    where: { id: BigInt(nomineeId) },
    data: updateData,
  });

  return {
    id: updatedNominee.id.toString(),
    name: updatedNominee.name,
    relationship: updatedNominee.relationship,
    mobileNumber: updatedNominee.mobile_number,
    email: updatedNominee.email,
    address: updatedNominee.address,
    createdAt: updatedNominee.created_at,
    updatedAt: updatedNominee.updated_at,
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

