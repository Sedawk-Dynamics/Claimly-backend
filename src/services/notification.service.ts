import prisma from "../config/prismaClient";
import logger from "../config/logger";
import admin from "../config/firebase";
import { getFCMToken } from "./user.service";

export class NotificationService {
  async createNotification(adminId: bigint, userId: bigint, title: string, message: string) {
    const notification = await prisma.adminNotification.create({
      data: {
        admin_id: adminId,
        user_id: userId,
        title,
        message,
      },
    });

    // Send push notification if FCM token exists
    try {
      await sendPushNotification(userId.toString(), title, message, notification.id.toString());
    } catch (error) {
      // Log error but don't fail notification creation
      logger.error('Failed to send push notification', {
        userId: userId.toString(),
        notificationId: notification.id.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return notification;
  }

  async listUserNotifications(userId: bigint) {
    return prisma.adminNotification.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });
  }

  async markAsRead(userId: bigint, notificationId: bigint) {
    return prisma.adminNotification.updateMany({
      where: {
        id: notificationId,
        user_id: userId,
      },
      data: {
        is_read: true,
      },
    });
  }

  async deleteNotification(userId: bigint, notificationId: bigint) {
    return prisma.adminNotification.deleteMany({
      where: {
        id: notificationId,
        user_id: userId,
      },
    });
  }

  async deleteOldNotifications() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const result = await prisma.adminNotification.deleteMany({
      where: {
        created_at: {
          lt: oneWeekAgo,
        },
      },
    });

    logger.info('Deleted old notifications', {
      count: result.count,
      olderThan: oneWeekAgo.toISOString(),
    });

    return result;
  }
}

export const notificationService = new NotificationService();

/**
 * Helper function to automatically send notifications to users when admin performs actions
 * This function silently fails if notification creation fails to not interrupt the main flow
 */
export async function sendAdminActionNotification(
  adminId: string,
  userId: string,
  actionType: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    const title = getNotificationTitle(actionType, details);
    const message = getNotificationMessage(actionType, details);

    const notification = await notificationService.createNotification(
      BigInt(adminId),
      BigInt(userId),
      title,
      message
    );

    logger.info('Admin action notification sent', {
      adminId,
      userId,
      actionType,
      notificationId: notification.id.toString(),
    });
  } catch (error) {
    // Silently fail - don't interrupt the main flow if notification fails
    logger.error('Failed to send admin action notification', {
      adminId,
      userId,
      actionType,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function getNotificationTitle(actionType: string, details?: Record<string, any>): string {
  switch (actionType) {
    case 'DOCUMENT_VERIFIED':
      return `Document ${details?.documentType || 'Document'} Verified`;
    case 'DOCUMENT_REJECTED':
      return `Document ${details?.documentType || 'Document'} Rejected`;
    case 'KYC_ACCEPTED':
      return 'KYC Documents Accepted';
    case 'KYC_REJECTED':
      return 'KYC Documents Rejected';
    case 'POLICY_DOCUMENT_VERIFIED':
      return `Policy Document Verified`;
    case 'POLICY_DOCUMENT_REJECTED':
      return `Policy Document Rejected`;
    case 'POLICY_ACCEPTED':
      return 'Policy Accepted';
    case 'POLICY_REJECTED':
      return 'Policy Rejected';
    case 'POLICY_ACTIVATED':
      return 'Policy Activated';
    case 'NOMINEE_DOCUMENT_VERIFIED':
      return `Nominee Document Verified`;
    case 'NOMINEE_DOCUMENT_REJECTED':
      return `Nominee Document Rejected`;
    case 'NOMINEE_ACCEPTED':
      return 'Nominee Accepted';
    case 'NOMINEE_REJECTED':
      return 'Nominee Rejected';
    case 'ALERT_VERIFIED':
      return 'Alert Verified';
    case 'ALERT_FALSE_ALERT':
      return 'Alert Marked as False';
    case 'SUBSCRIPTION_STATUS_CHANGED':
      return `Subscription Status Updated to ${details?.newStatus || 'Updated'}`;
    default:
      return 'Admin Action Completed';
  }
}

function getNotificationMessage(actionType: string, details?: Record<string, any>): string {
  switch (actionType) {
    case 'DOCUMENT_VERIFIED':
      return `Your ${details?.documentType || 'document'} (${details?.documentName || ''}) has been verified and approved by the admin.`;
    case 'DOCUMENT_REJECTED':
      return `Your ${details?.documentType || 'document'} (${details?.documentName || ''}) has been rejected. Please upload a new document.`;
    case 'KYC_ACCEPTED':
      return 'Your KYC documents have been accepted. You can now proceed with other activities.';
    case 'KYC_REJECTED':
      return 'Your KYC documents have been rejected. Please upload valid documents to continue.';
    case 'POLICY_DOCUMENT_VERIFIED':
      return `Your policy document (${details?.documentName || ''}) for policy ${details?.policyNumber || ''} has been verified.`;
    case 'POLICY_DOCUMENT_REJECTED':
      return `Your policy document (${details?.documentName || ''}) for policy ${details?.policyNumber || ''} has been rejected. Please upload a new document.`;
    case 'POLICY_ACCEPTED':
      return `Your policy ${details?.policyNumber || ''} has been accepted.`;
    case 'POLICY_REJECTED':
      return `Your policy ${details?.policyNumber || ''} has been rejected.`;
    case 'POLICY_ACTIVATED':
      return `Your policy ${details?.policyNumber || ''} has been activated. All documents have been verified.`;
    case 'NOMINEE_DOCUMENT_VERIFIED':
      return `Document for nominee ${details?.nomineeName || ''} has been verified.`;
    case 'NOMINEE_DOCUMENT_REJECTED':
      return `Document for nominee ${details?.nomineeName || ''} has been rejected. Please upload a new document.`;
    case 'NOMINEE_ACCEPTED':
      return `Nominee ${details?.nomineeName || ''} has been accepted.`;
    case 'NOMINEE_REJECTED':
      return `Nominee ${details?.nomineeName || ''} has been rejected.`;
    case 'ALERT_VERIFIED':
      return 'The deceased alert has been verified by the admin.';
    case 'ALERT_FALSE_ALERT':
      return 'The deceased alert has been marked as false by the admin.';
    case 'SUBSCRIPTION_STATUS_CHANGED':
      return `Your subscription status has been updated to ${details?.newStatus || 'updated'}.`;
    default:
      return 'An admin action has been performed on your account.';
  }
}

/**
 * Send push notification via Firebase Cloud Messaging
 */
async function sendPushNotification(
  userId: string,
  title: string,
  message: string,
  notificationId: string
): Promise<void> {
  // Check if Firebase Admin is initialized
  if (!admin.apps.length) {
    logger.warn('Firebase Admin not initialized, skipping push notification');
    return;
  }

  try {
    // Get FCM token for user
    const fcmToken = await getFCMToken(userId);
    
    if (!fcmToken) {
      logger.debug('No FCM token found for user', { userId });
      return;
    }

    // Send push notification
    const messagePayload = {
      notification: {
        title,
        body: message,
      },
      data: {
        title,
        message,
        notificationId,
        url: '/notifications',
      },
      token: fcmToken,
    };

    const response = await admin.messaging().send(messagePayload);
    logger.info('Push notification sent successfully', {
      userId,
      notificationId,
      messageId: response,
    });
  } catch (error: any) {
    // Handle specific FCM errors
    if (error.code === 'messaging/invalid-registration-token' || 
        error.code === 'messaging/registration-token-not-registered') {
      // Token is invalid, remove it
      logger.warn('Invalid FCM token, removing from user', { userId });
      try {
        await prisma.user.update({
          where: { id: BigInt(userId) },
          data: { device_id: null },
        });
      } catch (updateError) {
        logger.error('Failed to remove invalid FCM token', { userId, error: updateError });
      }
    } else {
      logger.error('Failed to send push notification', {
        userId,
        notificationId,
        error: error.message || 'Unknown error',
        code: error.code,
      });
    }
    // Don't throw - we don't want to fail notification creation if push fails
  }
}


