import prisma from '../config/prismaClient';
import { NotFoundError } from '../utils/errors';

export const getAllUsers = async (page: number = 1, limit: number = 20, search?: string) => {
  const skip = (page - 1) * limit;
  const where: any = {};

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { mobile_number: { contains: search } },
      { firebase_id: { contains: search } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        dob: true,
        email: true,
        mobile_number: true,
        subscription_status: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: {
            policies: true,
            nominees: true,
            documents: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: users.map((user) => ({
      id: user.id.toString(),
      name: user.name,
      dob: user.dob,
      email: user.email,
      mobileNumber: user.mobile_number,
      subscriptionStatus: user.subscription_status,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      stats: {
        policiesCount: user._count.policies,
        nomineesCount: user._count.nominees,
        documentsCount: user._count.documents,
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

export const getUserById = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    include: {
      policies: {
        include: {
          insurance_company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          uploaded_at: 'desc',
        },
        take: 10,
      },
      nominees: {
        include: {
          documents: {
            orderBy: {
              uploaded_at: 'desc',
            },
          },
          policy_links: {
            include: {
              policy: {
                select: {
                  id: true,
                  policy_number: true,
                },
              },
            },
          },
        },
      },
      subscriptions: {
        orderBy: {
          transaction_date: 'desc',
        },
        take: 5,
      },
      documents: {
        orderBy: {
          uploaded_at: 'desc',
        },
      },
      deceased_alerts: {
        orderBy: {
          created_at: 'desc',
        },
        take: 10,
      },
      _count: {
        select: {
          policies: true,
          nominees: true,
          subscriptions: true,
          documents: true,
          deceased_alerts: true,
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return {
    id: user.id.toString(),
    name: user.name,
    dob: user.dob,
    email: user.email,
    mobileNumber: user.mobile_number,
    firebaseUid: user.firebase_id,
    deviceId: user.device_id,
    subscriptionStatus: user.subscription_status,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    stats: {
      policiesCount: user._count.policies,
      nomineesCount: user._count.nominees,
      subscriptionsCount: user._count.subscriptions,
      documentsCount: user._count.documents,
      alertsCount: user._count.deceased_alerts,
    },
    nominees: user.nominees.map((nominee) => ({
      id: nominee.id.toString(),
      name: nominee.name,
      relationship: nominee.relationship,
      mobileNumber: nominee.mobile_number,
      email: nominee.email,
      address: nominee.address,
      createdAt: nominee.created_at,
      updatedAt: nominee.updated_at,
      policies: nominee.policy_links.map((link) => ({
        id: link.policy.id.toString(),
        policyNumber: link.policy.policy_number,
      })),
      documents: nominee.documents.map((document) => ({
        id: document.id.toString(),
        documentType: document.document_type,
        documentName: document.document_name,
        documentUrl: document.document_url,
        isVerified: document.is_verified,
        uploadedAt: document.uploaded_at,
        verifiedAt: document.verified_at,
      })),
    })),
    documents: user.documents.map((document) => ({
      id: document.id.toString(),
      documentType: document.document_type,
      documentName: document.document_name,
      documentUrl: document.document_url,
      isVerified: document.is_verified,
      uploadedAt: document.uploaded_at,
      verifiedAt: document.verified_at,
    })),
    recentPolicies: user.policies.map((policy) => ({
      id: policy.id.toString(),
      policyNumber: policy.policy_number,
      sumAssured: policy.sum_assured.toString(),
      status: policy.status,
      insuranceCompany: {
        id: policy.insurance_company.id.toString(),
        name: policy.insurance_company.name,
      },
    })),
    recentSubscriptions: user.subscriptions.map((sub) => ({
      id: sub.id.toString(),
      planName: sub.plan_name,
      amount: sub.amount.toString(),
      paymentStatus: sub.payment_status,
      transactionDate: sub.transaction_date,
    })),
    recentAlerts: user.deceased_alerts.map((alert) => ({
      id: alert.id.toString(),
      detectedVia: alert.detected_via,
      detectionDate: alert.detection_date,
      verificationStatus: alert.verification_status,
      createdAt: alert.created_at,
    })),
  };
};

export const updateUserStatus = async (userId: string, subscriptionStatus: 'ACTIVE' | 'INACTIVE' | 'EXPIRED') => {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const updatedUser = await prisma.user.update({
    where: { id: BigInt(userId) },
    data: { subscription_status: subscriptionStatus },
    select: {
      id: true,
      name: true,
      email: true,
      subscription_status: true,
      updated_at: true,
    },
  });

  return {
    id: updatedUser.id.toString(),
    name: updatedUser.name,
    email: updatedUser.email,
    subscriptionStatus: updatedUser.subscription_status,
    updatedAt: updatedUser.updated_at,
  };
};

