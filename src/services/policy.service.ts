import prisma from '../config/prismaClient';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import logger from '../config/logger';
import { getUserKycStatus } from './user.service';
import { createActivityLog } from './userActivityLog.service';

type PolicyStatusType = 'DRAFT' | 'PENDING' | 'ACCEPTED' | 'REJECTED';

type PolicyNomineeWithStatus = {
  nominee?: {
    status?: PolicyStatusType | null;
  } | null;
} | null;

/**
 * Helper function to check if a policy is complete (all required fields, documents, and nominee details filled)
 * Returns true if complete, false otherwise
 */
const isPolicyComplete = async (policyId: bigint): Promise<boolean> => {
  const policy = await prisma.policy.findUnique({
    where: { id: policyId },
    include: {
      policy_nominees: {
        include: {
          nominee: {
            select: {
              id: true,
              name: true,
              relationship: true,
              mobile_number: true,
              dob: true,
            },
          },
        },
      },
      documents: true,
    },
  });

  if (!policy) {
    return false;
  }

  // Check required policy fields
  const hasRequiredFields = 
    !!policy.policy_number && 
    !!policy.sum_assured && 
    !!policy.insurance_company_id;

  if (!hasRequiredFields) {
    return false;
  }

  // Check if at least one document is uploaded
  const hasDocuments = policy.documents.length > 0;

  if (!hasDocuments) {
    return false;
  }

  // Check if at least one nominee is added - REQUIRED for policy to be complete
  if (policy.policy_nominees.length === 0) {
    return false;
  }

  // Check if all linked nominees have complete details
  // Required fields for nominees: name, relationship, mobile_number, dob
  for (const policyNominee of policy.policy_nominees) {
    const nominee = policyNominee.nominee;
    const hasCompleteNomineeDetails = 
      !!nominee.name &&
      !!nominee.relationship &&
      !!nominee.mobile_number &&
      !!nominee.dob;

    if (!hasCompleteNomineeDetails) {
      return false;
    }
  }

  return true;
};

export const derivePolicyStatusFromNominees = (
  baseStatus: PolicyStatusType,
  policyNominees?: PolicyNomineeWithStatus[]
): PolicyStatusType => {
  if (baseStatus === 'REJECTED') {
    return 'REJECTED';
  }

  // If no nominees are added, always return DRAFT regardless of baseStatus
  if (!policyNominees || policyNominees.length === 0) {
    return 'DRAFT';
  }

  let hasPendingNominee = false;

  for (const policyNominee of policyNominees) {
    const nomineeStatus = policyNominee?.nominee?.status as PolicyStatusType | undefined;

    if (nomineeStatus === 'REJECTED') {
      return 'REJECTED';
    }

    if (nomineeStatus === 'PENDING') {
      hasPendingNominee = true;
    }
  }

  if (hasPendingNominee) {
    return 'PENDING';
  }

  return baseStatus;
};

/**
 * Helper function to update policy status based on completeness
 * Only updates status for DRAFT and PENDING policies, never for ACCEPTED or REJECTED
 * Ensures policies without nominees are always set to DRAFT
 */
export const updatePolicyStatusBasedOnCompleteness = async (policyId: string): Promise<void> => {
  const policyIdBigInt = BigInt(policyId);
  
  // Get current policy status and nominee count
  const policy = await prisma.policy.findUnique({
    where: { id: policyIdBigInt },
    select: { 
      id: true, 
      status: true,
      _count: {
        select: {
          policy_nominees: true,
        },
      },
    },
  });

  if (!policy) {
    return;
  }

  // If policy has no nominees, always set to DRAFT (unless ACCEPTED or REJECTED)
  if (policy._count.policy_nominees === 0) {
    if (policy.status !== 'ACCEPTED' && policy.status !== 'REJECTED') {
      await prisma.policy.update({
        where: { id: policyIdBigInt },
        data: { status: 'DRAFT' },
      });
      logger.info('Policy status updated to DRAFT (no nominees)', {
        policyId,
      });
    }
    return;
  }

  // Only auto-update status for DRAFT and PENDING policies
  // Never change ACCEPTED or REJECTED statuses
  if (policy.status !== 'DRAFT' && policy.status !== 'PENDING') {
    return;
  }

  const isComplete = await isPolicyComplete(policyIdBigInt);

  if (isComplete && policy.status === 'DRAFT') {
    // Move from DRAFT to PENDING when complete
    await prisma.policy.update({
      where: { id: policyIdBigInt },
      data: { status: 'PENDING' },
    });
    logger.info('Policy status updated to PENDING (completed)', {
      policyId,
    });
  } else if (!isComplete && policy.status === 'PENDING') {
    // Move from PENDING to DRAFT when incomplete
    await prisma.policy.update({
      where: { id: policyIdBigInt },
      data: { status: 'DRAFT' },
    });
    logger.info('Policy status updated to DRAFT (incomplete)', {
      policyId,
    });
  }
};

export interface CreatePolicyData {
  insuranceCompanyId: string;
  policyNumber: string;
  sumAssured: string;
}

export interface CreatePolicyDraftData {
  insuranceCompanyId: string;
  policyNumber?: string;
  sumAssured?: string;
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
              status: true,
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
    status: derivePolicyStatusFromNominees(policy.status, policy.policy_nominees),
    uploadedAt: policy.uploaded_at,
    nominees: policy.policy_nominees.map((pn) => ({
      id: pn.id.toString(),
      nominee: {
        id: pn.nominee.id.toString(),
        name: pn.nominee.name,
        relationship: pn.nominee.relationship,
        status: pn.nominee.status,
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

export const createPolicyDraft = async (userId: string, data: CreatePolicyDraftData) => {
  logger.info('Saving policy draft', { userId, policyNumber: data.policyNumber });

  if (!data.insuranceCompanyId) {
    throw new ValidationError('insuranceCompanyId is required to save a draft policy');
  }

  // Verify insurance company exists
  const insuranceCompany = await prisma.insuranceCompany.findUnique({
    where: { id: BigInt(data.insuranceCompanyId) },
  });

  if (!insuranceCompany) {
    throw new NotFoundError('Insurance company not found');
  }

  // Validate provided policy number if present
  let policyNumber = data.policyNumber?.trim();
  if (policyNumber) {
    const existingPolicy = await prisma.policy.findUnique({
      where: { policy_number: policyNumber },
    });

    if (existingPolicy) {
      throw new ConflictError('Policy number already exists');
    }
  } else {
    policyNumber = `DRAFT-${userId}-${Date.now()}`;
  }

  // Validate sum assured if provided, otherwise default to 0 for draft
  let sumAssured = 0;
  if (data.sumAssured !== undefined && data.sumAssured !== '') {
    const parsed = parseFloat(data.sumAssured);
    if (isNaN(parsed) || parsed < 0) {
      throw new ValidationError('Sum assured must be zero or a positive number');
    }
    sumAssured = parsed;
  }

  const policy = await prisma.policy.create({
    data: {
      user_id: BigInt(userId),
      insurance_company_id: BigInt(data.insuranceCompanyId),
      policy_number: policyNumber,
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
              status: true,
            },
          },
        },
      },
      documents: true,
    },
  });

  await createActivityLog({
    userId,
    activityType: 'POLICY_DRAFT_SAVED',
    description: `Saved policy draft: ${policy.policy_number}`,
    metadata: {
      policyId: policy.id.toString(),
      policyNumber: policy.policy_number,
      insuranceCompany: insuranceCompany.name,
      sumAssured: policy.sum_assured.toString(),
    },
  }).catch((err) => {
    console.error('Failed to log policy draft activity:', err);
  });

  await updatePolicyStatusBasedOnCompleteness(policy.id.toString()).catch((err) => {
    logger.error('Failed to update policy status based on completeness', {
      policyId: policy.id.toString(),
      error: err,
    });
  });

  const policyWithStatus = await prisma.policy.findUnique({
    where: { id: policy.id },
    select: { status: true },
  });

  return {
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
    status: derivePolicyStatusFromNominees(
      policyWithStatus?.status || policy.status,
      policy.policy_nominees
    ),
    uploadedAt: policy.uploaded_at,
    nominees: policy.policy_nominees.map((pn) => ({
      id: pn.id.toString(),
      nominee: {
        id: pn.nominee.id.toString(),
        name: pn.nominee.name,
        relationship: pn.nominee.relationship,
        status: pn.nominee.status,
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
  };
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
              status: true,
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

  return policies.map((policy) => {
    const resolvedStatus = derivePolicyStatusFromNominees(policy.status, policy.policy_nominees);

    return {
      id: policy.id.toString(),
      insuranceCompany: {
        id: policy.insurance_company.id.toString(),
        name: policy.insurance_company.name,
        contactEmail: policy.insurance_company.contact_email,
        contactNumber: policy.insurance_company.contact_number,
      },
      policyNumber: policy.policy_number,
      sumAssured: policy.sum_assured.toString(),
      status: resolvedStatus,
      uploadedAt: policy.uploaded_at,
      nominees: policy.policy_nominees.map((pn) => ({
        id: pn.id.toString(),
        nominee: {
          id: pn.nominee.id.toString(),
          name: pn.nominee.name,
          relationship: pn.nominee.relationship,
          status: pn.nominee.status,
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
    };
  });
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
              status: true,
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

  const resolvedStatus = derivePolicyStatusFromNominees(policy.status, policy.policy_nominees);

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
    status: resolvedStatus,
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
        status: pn.nominee.status,
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
              status: true,
            },
          },
        },
      },
      documents: true,
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

  await prisma.policy.update({
    where: { id: BigInt(policyId) },
    data: updateData,
  });

  // After updating basic fields, check completeness and update status accordingly
  // This will update status from DRAFT to PENDING if complete, or PENDING to DRAFT if incomplete
  await updatePolicyStatusBasedOnCompleteness(policyId).catch((err) => {
    // Don't fail the request if status update fails
    logger.error('Failed to update policy status based on completeness', {
      policyId,
      error: err,
    });
  });

  // Fetch the policy again to get the updated status and nominees
  const policyWithStatus = await prisma.policy.findUnique({
    where: { id: BigInt(policyId) },
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
              status: true,
            },
          },
        },
      },
      documents: true,
    },
  });

  if (!policyWithStatus) {
    throw new NotFoundError('Policy not found after update');
  }

  const resolvedStatus = derivePolicyStatusFromNominees(
    policyWithStatus.status || 'DRAFT',
    policyWithStatus.policy_nominees
  );

  return {
    id: policyWithStatus.id.toString(),
    insuranceCompany: {
      id: policyWithStatus.insurance_company.id.toString(),
      name: policyWithStatus.insurance_company.name,
      contactEmail: policyWithStatus.insurance_company.contact_email,
      contactNumber: policyWithStatus.insurance_company.contact_number,
    },
    policyNumber: policyWithStatus.policy_number,
    sumAssured: policyWithStatus.sum_assured.toString(),
    status: resolvedStatus,
    uploadedAt: policyWithStatus.uploaded_at,
    nominees: policyWithStatus.policy_nominees.map((pn) => ({
      id: pn.id.toString(),
      nominee: {
        id: pn.nominee.id.toString(),
        name: pn.nominee.name,
        relationship: pn.nominee.relationship,
        status: pn.nominee.status,
      },
      sharePercentage: pn.share_percentage?.toString?.() ?? '',
    })),
    documents: policyWithStatus.documents.map((doc) => ({
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

