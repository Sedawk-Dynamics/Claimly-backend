import prisma from '../config/prismaClient';
import { NotFoundError, ValidationError } from '../utils/errors';
import { sendAdminActionNotification } from './notification.service';

export interface VerifyAlertData {
  verificationStatus: 'VERIFIED' | 'FALSE_ALERT';
  remarks?: string;
}

// Helper function to determine alert type from remarks
const getAlertType = (remarks: string): string => {
  if (!remarks) return 'OTHER';
  const lowerRemarks = remarks.toLowerCase();
  if (lowerRemarks.includes('new user registered') || lowerRemarks.includes('new user')) {
    return 'NEW_USER';
  }
  if (lowerRemarks.includes('new policy added') || lowerRemarks.includes('policy')) {
    return 'NEW_POLICY';
  }
  if (lowerRemarks.includes('new nominee added') || lowerRemarks.includes('nominee')) {
    return 'NEW_NOMINEE';
  }
  if (lowerRemarks.includes('subscription purchased') || lowerRemarks.includes('subscription')) {
    return 'SUBSCRIPTION';
  }
  return 'OTHER';
};

export const getAllAlerts = async (
  page: number = 1,
  limit: number = 20,
  status?: 'PENDING' | 'VERIFIED' | 'FALSE_ALERT',
  search?: string,
  detectedVia?: 'SMS' | 'MANUAL',
  startDate?: string,
  endDate?: string
) => {
  const skip = (page - 1) * limit;
  const where: any = {};

  if (status) {
    where.verification_status = status;
  }

  if (detectedVia) {
    where.detected_via = detectedVia;
  }

  if (startDate || endDate) {
    where.created_at = {};
    if (startDate) {
      where.created_at.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.created_at.lte = end;
    }
  }

  // Search functionality - search in user name, email, mobile number, or remarks
  if (search && search.trim()) {
    const searchTerm = search.trim();
    where.OR = [
      {
        user: {
          name: {
            contains: searchTerm,
          },
        },
      },
      {
        user: {
          email: {
            contains: searchTerm,
          },
        },
      },
      {
        user: {
          mobile_number: {
            contains: searchTerm,
          },
        },
      },
      {
        remarks: {
          contains: searchTerm,
        },
      },
    ];
  }

  const [alerts, total] = await Promise.all([
    prisma.deceasedAlert.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile_number: true,
          },
        },
        verified_admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.deceasedAlert.count({ where }),
  ]);

  return {
    alerts: alerts.map((alert) => ({
      id: alert.id.toString(),
      user: {
        id: alert.user.id.toString(),
        name: alert.user.name,
        email: alert.user.email,
        mobileNumber: alert.user.mobile_number,
      },
      detectedVia: alert.detected_via,
      detectionDate: alert.detection_date,
      verificationStatus: alert.verification_status,
      verifiedBy: alert.verified_by
        ? {
            id: alert.verified_admin?.id.toString(),
            name: alert.verified_admin?.name,
            email: alert.verified_admin?.email,
          }
        : null,
      smsText: alert.sms_text,
      remarks: alert.remarks,
      createdAt: alert.created_at,
      alertType: getAlertType(alert.remarks || ''),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getAlertById = async (alertId: string) => {
  const alert = await prisma.deceasedAlert.findUnique({
    where: { id: BigInt(alertId) },
    include: {
      user: {
        include: {
          policies: {
            include: {
              insurance_company: {
                select: {
                  id: true,
                  name: true,
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
                      dob: true,
                    },
                  },
                },
              },
            },
          },
          nominees: true,
        },
      },
      verified_admin: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!alert) {
    throw new NotFoundError('Alert not found');
  }

  return {
    id: alert.id.toString(),
    user: {
      id: alert.user.id.toString(),
      name: alert.user.name,
      email: alert.user.email,
      mobileNumber: alert.user.mobile_number,
      dob: alert.user.dob,
    },
    detectedVia: alert.detected_via,
    detectionDate: alert.detection_date,
    verificationStatus: alert.verification_status,
    verifiedBy: alert.verified_by
      ? {
          id: alert.verified_admin?.id.toString(),
          name: alert.verified_admin?.name,
          email: alert.verified_admin?.email,
        }
      : null,
    smsText: alert.sms_text,
    remarks: alert.remarks,
    createdAt: alert.created_at,
    userPolicies: alert.user.policies.map((policy) => ({
      id: policy.id.toString(),
      policyNumber: policy.policy_number,
      sumAssured: policy.sum_assured.toString(),
      insuranceCompany: {
        id: policy.insurance_company.id.toString(),
        name: policy.insurance_company.name,
      },
      nominees: policy.policy_nominees.map((pn) => ({
        nominee: {
          id: pn.nominee.id.toString(),
          name: pn.nominee.name,
          relationship: pn.nominee.relationship,
          mobileNumber: pn.nominee.mobile_number,
          dob: pn.nominee.dob ? pn.nominee.dob.toISOString().split('T')[0] : null,
        },
        sharePercentage: pn.share_percentage.toString(),
      })),
    })),
    userNominees: alert.user.nominees.map((nominee) => ({
      id: nominee.id.toString(),
      name: nominee.name,
      relationship: nominee.relationship,
      mobileNumber: nominee.mobile_number,
      dob: nominee.dob ? nominee.dob.toISOString().split('T')[0] : null,
      email: nominee.email,
    })),
  };
};

export const verifyAlert = async (adminId: string, alertId: string, data: VerifyAlertData) => {
  const alert = await prisma.deceasedAlert.findUnique({
    where: { id: BigInt(alertId) },
  });

  if (!alert) {
    throw new NotFoundError('Alert not found');
  }

  const validStatuses = ['VERIFIED', 'FALSE_ALERT'];
  if (!validStatuses.includes(data.verificationStatus)) {
    throw new ValidationError(`verificationStatus must be one of: ${validStatuses.join(', ')}`);
  }

  // Allow updating verification status even if already verified (to allow changing from VERIFIED to FALSE_ALERT or vice versa)

  const updatedAlert = await prisma.deceasedAlert.update({
    where: { id: BigInt(alertId) },
    data: {
      verification_status: data.verificationStatus,
      verified_by: BigInt(adminId),
      remarks: data.remarks || null,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      verified_admin: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // Send notification to user based on verification status
  const actionType = updatedAlert.verification_status === 'VERIFIED' ? 'ALERT_VERIFIED' : 'ALERT_FALSE_ALERT';
  await sendAdminActionNotification(adminId, updatedAlert.user.id.toString(), actionType);

  return {
    id: updatedAlert.id.toString(),
    user: {
      id: updatedAlert.user.id.toString(),
      name: updatedAlert.user.name,
      email: updatedAlert.user.email,
    },
    detectedVia: updatedAlert.detected_via,
    detectionDate: updatedAlert.detection_date,
    verificationStatus: updatedAlert.verification_status,
    verifiedBy: {
      id: updatedAlert.verified_admin?.id.toString(),
      name: updatedAlert.verified_admin?.name,
      email: updatedAlert.verified_admin?.email,
    },
    remarks: updatedAlert.remarks,
    createdAt: updatedAlert.created_at,
  };
};

export const getAlertStats = async () => {
  const [total, pending, verified, falseAlerts, smsAlerts, manualAlerts] = await Promise.all([
    prisma.deceasedAlert.count(),
    prisma.deceasedAlert.count({ where: { verification_status: 'PENDING' } }),
    prisma.deceasedAlert.count({ where: { verification_status: 'VERIFIED' } }),
    prisma.deceasedAlert.count({ where: { verification_status: 'FALSE_ALERT' } }),
    prisma.deceasedAlert.count({ where: { detected_via: 'SMS' } }),
    prisma.deceasedAlert.count({ where: { detected_via: 'MANUAL' } }),
  ]);

  // Get alerts by type from last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentAlerts = await prisma.deceasedAlert.findMany({
    where: {
      created_at: {
        gte: thirtyDaysAgo,
      },
    },
    select: {
      remarks: true,
    },
  });

  const typeStats = {
    NEW_USER: 0,
    NEW_POLICY: 0,
    NEW_NOMINEE: 0,
    SUBSCRIPTION: 0,
    OTHER: 0,
  };

  recentAlerts.forEach((alert) => {
    const type = getAlertType(alert.remarks || '');
    if (type in typeStats) {
      typeStats[type as keyof typeof typeStats]++;
    }
  });

  return {
    total,
    pending,
    verified,
    falseAlerts,
    smsAlerts,
    manualAlerts,
    typeStats,
  };
};

export const bulkVerifyAlerts = async (
  adminId: string,
  alertIds: string[],
  data: VerifyAlertData
) => {
  const results = [];
  const errors = [];

  for (const alertId of alertIds) {
    try {
      const result = await verifyAlert(adminId, alertId, data);
      results.push(result);
    } catch (error) {
      errors.push({ alertId, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  return {
    success: results.length,
    failed: errors.length,
    results,
    errors,
  };
};

