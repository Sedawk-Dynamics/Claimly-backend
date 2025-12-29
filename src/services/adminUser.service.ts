import prisma from '../config/prismaClient';
import { NotFoundError } from '../utils/errors';
import { createActivityLog } from './userActivityLog.service';
import { sendAdminActionNotification } from './notification.service';

export const getAllUsers = async (page: number = 1, limit: number = 20, search?: string) => {
  const skip = (page - 1) * limit;
  const where: any = {};

  if (search && search.trim()) {
    const searchTerm = search.trim();
    where.OR = [
      { name: { contains: searchTerm } },
      { email: { contains: searchTerm } },
      { mobile_number: { contains: searchTerm } },
      { firebase_id: { contains: searchTerm } },
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
              contact_email: true,
              contact_number: true,
              website_url: true,
              address: true,
            },
          },
          documents: {
            orderBy: {
              uploaded_at: 'desc',
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
        },
        orderBy: [
          { uploaded_at: 'desc' },
          { id: 'desc' },
        ],
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
                  sum_assured: true,
                  status: true,
                },
              },
            },
          },
        },
        orderBy: {
          created_at: 'desc',
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
    referralCode: user.referral_code,
    walletBalance: Number(user.wallet_balance),
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
      dob: nominee.dob ? nominee.dob.toISOString().split('T')[0] : null,
      email: nominee.email,
      address: nominee.address,
      gender: nominee.gender,
      status: nominee.status,
      createdAt: nominee.created_at,
      updatedAt: nominee.updated_at,
      policies: nominee.policy_links.map((link) => ({
        id: link.policy.id.toString(),
        policyNumber: link.policy.policy_number,
        sumAssured: link.policy.sum_assured.toString(),
        status: link.policy.status,
        sharePercentage: link.share_percentage ? link.share_percentage.toString() : '0',
      })),
      documents: nominee.documents.map((document) => ({
        id: document.id.toString(),
        documentType: document.document_type,
        documentName: document.document_name,
        documentUrl: document.document_url,
        isVerified: document.is_verified,
        uploadedAt: document.uploaded_at,
        verifiedAt: document.verified_at,
        rejectedAt: document.rejected_at,
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
      rejectedAt: document.rejected_at,
    })),
    recentPolicies: user.policies.map((policy) => ({
      id: policy.id.toString(),
      policyNumber: policy.policy_number,
      sumAssured: policy.sum_assured.toString(),
      status: policy.status,
      uploadedAt: policy.uploaded_at,
      insuranceCompany: {
        id: policy.insurance_company.id.toString(),
        name: policy.insurance_company.name,
        contactEmail: policy.insurance_company.contact_email,
        contactNumber: policy.insurance_company.contact_number,
        websiteUrl: policy.insurance_company.website_url,
        address: policy.insurance_company.address,
      },
      nominees: policy.policy_nominees.map((pn) => ({
        id: pn.nominee.id.toString(),
        name: pn.nominee.name,
        relationship: pn.nominee.relationship,
        sharePercentage: pn.share_percentage.toString(),
      })),
      documents: policy.documents.map((document) => ({
        id: document.id.toString(),
        documentType: document.document_type,
        documentName: document.document_name,
        documentUrl: document.document_url,
        isVerified: document.is_verified,
        uploadedAt: document.uploaded_at,
        verifiedAt: document.verified_at,
        rejectedAt: document.rejected_at,
      })),
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

export const updateUserStatus = async (adminId: string, userId: string, subscriptionStatus: 'ACTIVE' | 'INACTIVE' | 'EXPIRED') => {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const previousStatus = user.subscription_status;

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

  // Log activity if subscription expired
  if (subscriptionStatus === 'EXPIRED' && previousStatus !== 'EXPIRED') {
    await createActivityLog({
      userId,
      activityType: 'SUBSCRIPTION_EXPIRED',
      description: 'Subscription expired',
      metadata: {
        previousStatus,
        newStatus: subscriptionStatus,
      },
    }).catch((err) => {
      // Don't fail the request if logging fails
      console.error('Failed to log activity:', err);
    });
  }

  // Send notification to user about status change
  if (previousStatus !== subscriptionStatus) {
    await sendAdminActionNotification(adminId, userId, 'SUBSCRIPTION_STATUS_CHANGED', {
      previousStatus,
      newStatus: subscriptionStatus,
    });
  }

  return {
    id: updatedUser.id.toString(),
    name: updatedUser.name,
    email: updatedUser.email,
    subscriptionStatus: updatedUser.subscription_status,
    updatedAt: updatedUser.updated_at,
  };
};

