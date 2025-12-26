import prisma from '../config/prismaClient';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import logger from '../config/logger';
import { getUserKycStatus } from './user.service';
import { createActivityLog } from './userActivityLog.service';

export interface CreatePolicyData {
  insuranceCompanyId: string;
  policyNumber: string;
  sumAssured: string;
}

export interface UpdatePolicyData {
  insuranceCompanyId?: string;
  policyNumber?: string;
  sumAssured?: string;
  status?: 'DRAFT' | 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

export const createPolicy = async (userId: string, data: CreatePolicyData) => {
  logger.info('Creating policy', { userId, policyNumber: data.policyNumber });
  
  // Ensure user has completed KYC (uploaded Aadhaar and PAN)
  const kycStatus = await getUserKycStatus(userId);

  if (kycStatus.status !== 'COMPLETED') {
    logger.warn('Attempt to create policy without completed KYC', {
      userId,
      missingDocuments: kycStatus.missingDocuments,
    });
    throw new ValidationError('KYC verification is required before adding policies');
  }

  // Check if policy number already exists
  const existingPolicy = await prisma.policy.findUnique({
    where: { policy_number: data.policyNumber },
  });

  if (existingPolicy) {
    throw new ConflictError('Policy number already exists');
  }

  // Verify insurance company exists
  const insuranceCompany = await prisma.insuranceCompany.findUnique({
    where: { id: BigInt(data.insuranceCompanyId) },
  });

  if (!insuranceCompany) {
    throw new NotFoundError('Insurance company not found');
  }

  // Validate sum assured
  const sumAssured = parseFloat(data.sumAssured);
  if (isNaN(sumAssured) || sumAssured <= 0) {
    throw new ValidationError('Sum assured must be a positive number');
  }

  const policy = await prisma.policy.create({
    data: {
      user_id: BigInt(userId),
      insurance_company_id: BigInt(data.insuranceCompanyId),
      policy_number: data.policyNumber,
      sum_assured: sumAssured,
      status: 'DRAFT',
    },
    include: {
      insurance_company: {
        select: {
          id: true,
          name: true,
          contact_email: true,
          contact_number: true,
        },
      },
      policy_nominees: {
        include: {
          nominee: {
            select: {
              id: true,
              name: true,
              relationship: true,
            },
          },
        },
      },
      documents: true,
    },
  });

  const result = {
    id: policy.id.toString(),
    userId: policy.user_id.toString(),
    insuranceCompany: {
      id: policy.insurance_company.id.toString(),
      name: policy.insurance_company.name,
      contactEmail: policy.insurance_company.contact_email,
      contactNumber: policy.insurance_company.contact_number,
    },
    policyNumber: policy.policy_number,
    sumAssured: policy.sum_assured.toString(),
    status: policy.status,
    uploadedAt: policy.uploaded_at,
    nominees: policy.policy_nominees.map((pn) => ({
      id: pn.id.toString(),
      nominee: {
        id: pn.nominee.id.toString(),
        name: pn.nominee.name,
        relationship: pn.nominee.relationship,
      },
      sharePercentage: pn.share_percentage.toString(),
    })),
    documents: policy.documents.map((doc) => ({
      id: doc.id.toString(),
      documentType: doc.document_type,
      documentName: doc.document_name,
      documentUrl: doc.document_url,
      isVerified: doc.is_verified,
      uploadedAt: doc.uploaded_at,
    })),
  };
  
  logger.info('Policy created successfully', { policyId: policy.id.toString(), userId });

  // Log activity
  await createActivityLog({
    userId,
    activityType: 'POLICY_ADDED',
    description: `Added policy: ${policy.policy_number} (${policy.insurance_company.name})`,
    metadata: {
      policyId: policy.id.toString(),
      policyNumber: policy.policy_number,
      insuranceCompany: policy.insurance_company.name,
      sumAssured: policy.sum_assured.toString(),
    },
  }).catch((err) => {
    // Don't fail the request if logging fails
    console.error('Failed to log activity:', err);
  });

  // Alert creation removed - alerts now only come from mobile app SMS reading

  return result;
};

export const getUserPolicies = async (userId: string) => {
  const policies = await prisma.policy.findMany({
    where: { user_id: BigInt(userId) },
    include: {
      insurance_company: {
        select: {
          id: true,
          name: true,
          contact_email: true,
          contact_number: true,
        },
      },
      policy_nominees: {
        include: {
          nominee: {
            select: {
              id: true,
              name: true,
              relationship: true,
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
    orderBy: { uploaded_at: 'desc' },
  });

  return policies.map((policy) => ({
    id: policy.id.toString(),
    insuranceCompany: {
      id: policy.insurance_company.id.toString(),
      name: policy.insurance_company.name,
      contactEmail: policy.insurance_company.contact_email,
      contactNumber: policy.insurance_company.contact_number,
    },
    policyNumber: policy.policy_number,
    sumAssured: policy.sum_assured.toString(),
    status: policy.status,
    uploadedAt: policy.uploaded_at,
    nominees: policy.policy_nominees.map((pn) => ({
      id: pn.id.toString(),
      nominee: {
        id: pn.nominee.id.toString(),
        name: pn.nominee.name,
        relationship: pn.nominee.relationship,
      },
      sharePercentage: pn.share_percentage.toString(),
    })),
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
  }));
};

export const getPolicyById = async (userId: string, policyId: string) => {
  const policy = await prisma.policy.findFirst({
    where: {
      id: BigInt(policyId),
      user_id: BigInt(userId),
    },
    include: {
      insurance_company: {
        select: {
          id: true,
          name: true,
          contact_email: true,
          contact_number: true,
          website_url: true,
          address: true,
        },
      },
      policy_nominees: {
        include: {
          nominee: {
            select: {
              id: true,
              name: true,
              relationship: true,
              mobile_number: true,
              email: true,
              address: true,
              dob: true,
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
  });

  if (!policy) {
    throw new NotFoundError('Policy not found');
  }

  return {
    id: policy.id.toString(),
    insuranceCompany: {
      id: policy.insurance_company.id.toString(),
      name: policy.insurance_company.name,
      contactEmail: policy.insurance_company.contact_email,
      contactNumber: policy.insurance_company.contact_number,
      websiteUrl: policy.insurance_company.website_url,
      address: policy.insurance_company.address,
    },
    policyNumber: policy.policy_number,
    sumAssured: policy.sum_assured.toString(),
    status: policy.status,
    uploadedAt: policy.uploaded_at,
    nominees: policy.policy_nominees.map((pn) => ({
      id: pn.id.toString(),
      nominee: {
        id: pn.nominee.id.toString(),
        name: pn.nominee.name,
        relationship: pn.nominee.relationship,
        mobileNumber: pn.nominee.mobile_number,
        dob: pn.nominee.dob ? pn.nominee.dob.toISOString().split('T')[0] : null,
        email: pn.nominee.email,
        address: pn.nominee.address,
      },
      sharePercentage: pn.share_percentage.toString(),
      createdAt: pn.created_at,
    })),
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
  };
};

export const updatePolicy = async (userId: string, policyId: string, data: UpdatePolicyData) => {
  // Verify policy exists and belongs to user
  const existingPolicy = await prisma.policy.findFirst({
    where: {
      id: BigInt(policyId),
      user_id: BigInt(userId),
    },
  });

  if (!existingPolicy) {
    throw new NotFoundError('Policy not found');
  }

  // Check if policy number is being changed and if it's already taken
  if (data.policyNumber && data.policyNumber !== existingPolicy.policy_number) {
    const policyWithNumber = await prisma.policy.findUnique({
      where: { policy_number: data.policyNumber },
    });

    if (policyWithNumber) {
      throw new ConflictError('Policy number already exists');
    }
  }

  // Verify insurance company if being updated
  if (data.insuranceCompanyId) {
    const insuranceCompany = await prisma.insuranceCompany.findUnique({
      where: { id: BigInt(data.insuranceCompanyId) },
    });

    if (!insuranceCompany) {
      throw new NotFoundError('Insurance company not found');
    }
  }

  // Validate sum assured if being updated
  if (data.sumAssured) {
    const sumAssured = parseFloat(data.sumAssured);
    if (isNaN(sumAssured) || sumAssured <= 0) {
      throw new ValidationError('Sum assured must be a positive number');
    }
  }

  const updateData: any = {};
  if (data.insuranceCompanyId) updateData.insurance_company_id = BigInt(data.insuranceCompanyId);
  if (data.policyNumber) updateData.policy_number = data.policyNumber;
  if (data.sumAssured) updateData.sum_assured = parseFloat(data.sumAssured);
  // Users should not be able to set ACCEPTED or REJECTED directly.
  // Allow explicit DRAFT only; otherwise compute status based on completeness after update.
  if (data.status === 'DRAFT') updateData.status = 'DRAFT';

  const updatedPolicy = await prisma.policy.update({
    where: { id: BigInt(policyId) },
    data: updateData,
    include: {
      insurance_company: {
        select: {
          id: true,
          name: true,
          contact_email: true,
          contact_number: true,
        },
      },
    },
  });

  // After updating basic fields, compute completeness to possibly move from DRAFT -> PENDING
  // Fetch counts for nominees and documents
  const policyWithCounts = await prisma.policy.findUnique({
    where: { id: BigInt(policyId) },
    include: {
      policy_nominees: true,
      documents: true,
    },
  });

  if (policyWithCounts) {
    const hasRequiredFields = !!policyWithCounts.policy_number && !!policyWithCounts.sum_assured && !!policyWithCounts.insurance_company_id;
    const hasNominees = policyWithCounts.policy_nominees.length > 0;
    const hasDocuments = policyWithCounts.documents.length > 0;

    // If all required fields, nominees and documents are present, move to PENDING
    if (hasRequiredFields && hasNominees && hasDocuments && policyWithCounts.status === 'DRAFT') {
      const promoted = await prisma.policy.update({
        where: { id: BigInt(policyId) },
        data: { status: 'PENDING' },
      });
      // reflect updated status in returned object
      (updatedPolicy as any).status = promoted.status;
    }
  }

  return {
    id: updatedPolicy.id.toString(),
    insuranceCompany: {
      id: updatedPolicy.insurance_company.id.toString(),
      name: updatedPolicy.insurance_company.name,
      contactEmail: updatedPolicy.insurance_company.contact_email,
      contactNumber: updatedPolicy.insurance_company.contact_number,
    },
    policyNumber: updatedPolicy.policy_number,
    sumAssured: updatedPolicy.sum_assured.toString(),
    status: updatedPolicy.status,
    uploadedAt: updatedPolicy.uploaded_at,
  };
};

export const deletePolicy = async (userId: string, policyId: string) => {
  const policy = await prisma.policy.findFirst({
    where: {
      id: BigInt(policyId),
      user_id: BigInt(userId),
    },
  });

  if (!policy) {
    throw new NotFoundError('Policy not found');
  }

  await prisma.policy.delete({
    where: { id: BigInt(policyId) },
  });

  return { message: 'Policy deleted successfully' };
};

