import prisma from '../config/prismaClient';
import { NotFoundError, ValidationError } from '../utils/errors';
import logger from '../config/logger';

export const acceptPolicy = async (policyId: string, adminId: string) => {
  const policy = await prisma.policy.findUnique({
    where: { id: BigInt(policyId) },
    include: { user: true },
  });

  if (!policy) {
    throw new NotFoundError('Policy not found');
  }

  if (policy.status === 'ACCEPTED') {
    throw new ValidationError('Policy is already accepted');
  }

  const updatedPolicy = await prisma.policy.update({
    where: { id: BigInt(policyId) },
    data: {
      status: 'ACCEPTED',
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
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          mobile_number: true,
        },
      },
    },
  });

  logger.info('Policy accepted', {
    policyId,
    adminId,
    userId: policy.user_id.toString(),
    policyNumber: policy.policy_number,
  });

  return {
    id: updatedPolicy.id.toString(),
    userId: updatedPolicy.user_id.toString(),
    user: {
      id: updatedPolicy.user.id.toString(),
      name: updatedPolicy.user.name,
      email: updatedPolicy.user.email,
      mobileNumber: updatedPolicy.user.mobile_number,
    },
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

export const rejectPolicy = async (policyId: string, adminId: string) => {
  const policy = await prisma.policy.findUnique({
    where: { id: BigInt(policyId) },
    include: { user: true },
  });

  if (!policy) {
    throw new NotFoundError('Policy not found');
  }

  if (policy.status === 'REJECTED') {
    throw new ValidationError('Policy is already rejected');
  }

  const updatedPolicy = await prisma.policy.update({
    where: { id: BigInt(policyId) },
    data: {
      status: 'REJECTED',
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
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          mobile_number: true,
        },
      },
    },
  });

  logger.info('Policy rejected', {
    policyId,
    adminId,
    userId: policy.user_id.toString(),
    policyNumber: policy.policy_number,
  });

  return {
    id: updatedPolicy.id.toString(),
    userId: updatedPolicy.user_id.toString(),
    user: {
      id: updatedPolicy.user.id.toString(),
      name: updatedPolicy.user.name,
      email: updatedPolicy.user.email,
      mobileNumber: updatedPolicy.user.mobile_number,
    },
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

export const getAllPolicies = async (page: number = 1, limit: number = 20, search?: string) => {
  const skip = (page - 1) * limit;
  
  // First, get all valid user IDs to filter out orphaned policies
  const validUserIds = await prisma.user.findMany({
    select: { id: true },
  }).then(users => users.map(u => u.id));
  
  // Build where clause - always filter by valid user IDs to avoid orphaned policies
  const whereClause: any = {
    user_id: { in: validUserIds },
  };

  if (search && search.trim()) {
    const searchTerm = search.trim();
    // Combine user_id filter with search conditions using AND
    whereClause.AND = [
      { user_id: { in: validUserIds } },
      {
        OR: [
          { policy_number: { contains: searchTerm } },
          { user: { name: { contains: searchTerm } } },
          { user: { mobile_number: { contains: searchTerm } } },
          { 
            user: {
              AND: [
                { email: { not: null } },
                { email: { contains: searchTerm } }
              ]
            }
          },
          { insurance_company: { name: { contains: searchTerm } } },
        ],
      },
    ];
    // Remove the standalone user_id since we're using it in AND
    delete whereClause.user_id;
  }

  try {
    const [policies, total] = await Promise.all([
      prisma.policy.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { uploaded_at: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              mobile_number: true,
              email: true,
            },
          },
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
              is_verified: true,
            },
          },
          _count: {
            select: {
              policy_nominees: true,
              documents: true,
            },
          },
        },
      }),
      prisma.policy.count({ where: whereClause }),
    ]);

    return {
      policies: policies
        .filter((policy) => policy.user !== null) // Filter out policies with null users
        .map((policy) => ({
          id: policy.id.toString(),
          userId: policy.user_id.toString(),
          user: policy.user ? {
            id: policy.user.id.toString(),
            name: policy.user.name,
            mobileNumber: policy.user.mobile_number,
            email: policy.user.email,
          } : null,
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
            dob: pn.nominee.dob ? pn.nominee.dob.toISOString().split('T')[0] : null,
          },
          sharePercentage: pn.share_percentage.toString(),
        })),
        documents: policy.documents.map((doc) => ({
          id: doc.id.toString(),
          documentType: doc.document_type,
          documentName: doc.document_name,
          isVerified: doc.is_verified,
        })),
        stats: {
          nomineesCount: policy._count.policy_nominees,
          documentsCount: policy._count.documents,
        },
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  } catch (error) {
    logger.error('Error fetching all policies', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      page,
      limit,
      search,
    });
    throw error;
  }
};

