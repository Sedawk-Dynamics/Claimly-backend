import prisma from '../config/prismaClient';

/**
 * Optimized query helpers for common Prisma operations
 * These helpers reduce N+1 queries and improve performance
 */

/**
 * Get user with all related data in a single query
 */
export const getUserWithRelations = async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: BigInt(userId) },
    include: {
      policies: {
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
              is_verified: true,
            },
          },
        },
      },
      nominees: {
        include: {
          policy_links: {
            select: {
              policy: {
                select: {
                  id: true,
                  policy_number: true,
                },
              },
              share_percentage: true,
            },
          },
        },
      },
      subscriptions: {
        orderBy: { transaction_date: 'desc' },
        take: 5,
      },
      _count: {
        select: {
          policies: true,
          nominees: true,
          subscriptions: true,
          documents: true,
        },
      },
    },
  });
};

/**
 * Get policy with all related data in a single query
 */
export const getPolicyWithRelations = async (policyId: string) => {
  return prisma.policy.findUnique({
    where: { id: BigInt(policyId) },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          mobile_number: true,
        },
      },
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
            },
          },
        },
      },
      documents: true,
    },
  });
};

/**
 * Get nominee with all related data in a single query
 */
export const getNomineeWithRelations = async (nomineeId: string) => {
  return prisma.nominee.findUnique({
    where: { id: BigInt(nomineeId) },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
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
};

/**
 * Batch fetch users with pagination optimization
 */
export const getUsersBatch = async (userIds: string[]) => {
  return prisma.user.findMany({
    where: {
      id: {
        in: userIds.map((id) => BigInt(id)),
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      mobile_number: true,
    },
  });
};

/**
 * Get policies with optimized includes for list view
 */
export const getPoliciesList = async (userId: string, page: number = 1, limit: number = 20) => {
  const skip = (page - 1) * limit;

  return prisma.policy.findMany({
    where: { user_id: BigInt(userId) },
    skip,
    take: limit,
    select: {
      id: true,
      policy_number: true,
      sum_assured: true,
      status: true,
      uploaded_at: true,
      insurance_company: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          policy_nominees: true,
          documents: true,
        },
      },
    },
    orderBy: { uploaded_at: 'desc' },
  });
};

