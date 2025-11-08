import prisma from '../config/prismaClient';
import { NotFoundError, ValidationError } from '../utils/errors';

export interface VerifyAlertData {
  verificationStatus: 'VERIFIED' | 'FALSE_ALERT';
  remarks?: string;
}

export const getAllAlerts = async (
  page: number = 1,
  limit: number = 20,
  status?: 'PENDING' | 'VERIFIED' | 'FALSE_ALERT'
) => {
  const skip = (page - 1) * limit;
  const where: any = {};

  if (status) {
    where.verification_status = status;
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
      remarks: alert.remarks,
      createdAt: alert.created_at,
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
        },
        sharePercentage: pn.share_percentage.toString(),
      })),
    })),
    userNominees: alert.user.nominees.map((nominee) => ({
      id: nominee.id.toString(),
      name: nominee.name,
      relationship: nominee.relationship,
      mobileNumber: nominee.mobile_number,
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

  if (alert.verification_status !== 'PENDING') {
    throw new ValidationError('Alert has already been verified');
  }

  const validStatuses = ['VERIFIED', 'FALSE_ALERT'];
  if (!validStatuses.includes(data.verificationStatus)) {
    throw new ValidationError(`verificationStatus must be one of: ${validStatuses.join(', ')}`);
  }

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
  const [total, pending, verified, falseAlerts] = await Promise.all([
    prisma.deceasedAlert.count(),
    prisma.deceasedAlert.count({ where: { verification_status: 'PENDING' } }),
    prisma.deceasedAlert.count({ where: { verification_status: 'VERIFIED' } }),
    prisma.deceasedAlert.count({ where: { verification_status: 'FALSE_ALERT' } }),
  ]);

  return {
    total,
    pending,
    verified,
    falseAlerts,
  };
};

