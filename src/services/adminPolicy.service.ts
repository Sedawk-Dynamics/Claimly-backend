import prisma from '../config/prismaClient';

export const getAllPolicies = async (page: number = 1, limit: number = 20, search?: string) => {
  const skip = (page - 1) * limit;
  const where: any = {};

  if (search) {
    where.OR = [
      { policy_number: { contains: search } },
      { user: { name: { contains: search } } },
      { user: { mobile_number: { contains: search } } },
      { insurance_company: { name: { contains: search } } },
    ];
  }

  const [policies, total] = await Promise.all([
    prisma.policy.findMany({
      where,
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
    prisma.policy.count({ where }),
  ]);

  return {
    policies: policies.map((policy) => ({
      id: policy.id.toString(),
      userId: policy.user_id.toString(),
      user: {
        id: policy.user.id.toString(),
        name: policy.user.name,
        mobileNumber: policy.user.mobile_number,
        email: policy.user.email,
      },
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
      totalPages: Math.ceil(total / limit),
    },
  };
};

