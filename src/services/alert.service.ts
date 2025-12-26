import prisma from '../config/prismaClient';
import { NotFoundError, ValidationError } from '../utils/errors';
import { sendAdminActionNotification } from './notification.service';

export interface CreateAlertData {
  userId: string;
  smsText: string;
  detectionDate?: string; // ISO date string, defaults to now
}

export const createAlert = async (data: CreateAlertData) => {
  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: BigInt(data.userId) },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Validate SMS text is provided
  if (!data.smsText || data.smsText.trim().length === 0) {
    throw new ValidationError('SMS text is required');
  }

  // Parse detection date or use current date
  let detectionDate: Date;
  if (data.detectionDate) {
    detectionDate = new Date(data.detectionDate);
    if (isNaN(detectionDate.getTime())) {
      throw new ValidationError('Invalid detectionDate format. Use ISO date string.');
    }
  } else {
    detectionDate = new Date();
  }

  // Create alert - always SMS detection method from mobile app
  const alert = await prisma.deceasedAlert.create({
    data: {
      user_id: BigInt(data.userId),
      detected_via: 'SMS',
      detection_date: detectionDate,
      verification_status: 'PENDING',
      sms_text: data.smsText.trim(),
      remarks: null,
    },
    include: {
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

  return {
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
    smsText: alert.sms_text,
    remarks: alert.remarks,
    createdAt: alert.created_at,
  };
};

export const verifyAlert = async (adminId: string, alertId: string, data: {
  verificationStatus: 'VERIFIED' | 'FALSE_ALERT';
  remarks?: string;
}) => {
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
      remarks: data.remarks || alert.remarks || null,
    },
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
      mobileNumber: updatedAlert.user.mobile_number,
    },
    detectedVia: updatedAlert.detected_via,
    detectionDate: updatedAlert.detection_date,
    verificationStatus: updatedAlert.verification_status,
    verifiedBy: updatedAlert.verified_admin
      ? {
          id: updatedAlert.verified_admin.id.toString(),
          name: updatedAlert.verified_admin.name,
          email: updatedAlert.verified_admin.email,
        }
      : null,
    remarks: updatedAlert.remarks,
    createdAt: updatedAlert.created_at,
  };
};

export const getAlertById = async (alertId: string) => {
  const alert = await prisma.deceasedAlert.findUnique({
    where: { id: BigInt(alertId) },
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
    },
    detectedVia: alert.detected_via,
    detectionDate: alert.detection_date,
    verificationStatus: alert.verification_status,
    verifiedBy: alert.verified_admin
      ? {
          id: alert.verified_admin.id.toString(),
          name: alert.verified_admin.name,
          email: alert.verified_admin.email,
        }
      : null,
    smsText: alert.sms_text,
    remarks: alert.remarks,
    createdAt: alert.created_at,
  };
};

