import prisma from "../config/prismaClient";
import logger from "../config/logger";
import admin from "../config/firebase";
import { getFCMToken } from "./user.service";

export class NotificationService {
  /**
   * Create a notification in the database and send push notification
   * This ensures ALL notifications are:
   * 1. Saved to database (for in-app display)
   * 2. Sent via FCM push (for when app is closed)
   * 
   * Database record is created FIRST, then push is sent.
   * If push fails, the database record still exists.
   */
  async createNotification(adminId: bigint, userId: bigint, title: string, message: string) {
    // Step 1: ALWAYS create database record first
    // This ensures the notification appears in the app even if push fails
    let notification;
    try {
      notification = await prisma.adminNotification.create({
        data: {
          admin_id: adminId,
          user_id: userId,
          title,
          message,
        },
      });

      logger.info('Notification created in database', {
        notificationId: notification.id.toString(),
        adminId: adminId.toString(),
        userId: userId.toString(),
        title,
      });
    } catch (dbError) {
      // If database creation fails, log and rethrow - this is critical
      logger.error('CRITICAL: Failed to create notification in database', {
        adminId: adminId.toString(),
        userId: userId.toString(),
        title,
        error: dbError instanceof Error ? dbError.message : 'Unknown error',
      });
      throw dbError; // Re-throw to ensure caller knows notification wasn't created
    }

    // Step 2: Send push notification (non-blocking - don't fail if this fails)
    // The database record already exists, so notification will show in app
    try {
      await sendPushNotification(userId.toString(), title, message, notification.id.toString());
      logger.info('Notification sent via push and saved to database', {
        notificationId: notification.id.toString(),
        userId: userId.toString(),
      });
    } catch (pushError) {
      // Log error but don't fail - database record already exists
      logger.warn('Push notification failed, but notification saved to database', {
        userId: userId.toString(),
        notificationId: notification.id.toString(),
        error: pushError instanceof Error ? pushError.message : 'Unknown error',
      });
      // Notification is still in database, so it will show in app
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

  /**
   * Create bulk notifications to multiple users
   * Supports: single user, all users, first N users, or selected users
   */
  async createBulkNotifications(
    adminId: bigint,
    title: string,
    message: string,
    mode: 'single' | 'all' | 'count' | 'selected',
    userIds?: string[],
    count?: number
  ) {
    let targetUserIds: bigint[] = [];

    // Get target user IDs based on mode
    switch (mode) {
      case 'single':
        if (!userIds || userIds.length === 0) {
          throw new Error('User ID is required for single mode');
        }
        targetUserIds = [BigInt(userIds[0])];
        break;

      case 'selected':
        if (!userIds || userIds.length === 0) {
          throw new Error('User IDs are required for selected mode');
        }
        targetUserIds = userIds.map((id) => BigInt(id));
        break;

      case 'count':
        if (!count || count <= 0) {
          throw new Error('Valid count is required for count mode');
        }
        const usersCount = await prisma.user.findMany({
          take: count,
          orderBy: { created_at: 'desc' },
          select: { id: true },
        });
        targetUserIds = usersCount.map((user) => user.id);
        break;

      case 'all':
        const allUsers = await prisma.user.findMany({
          select: { id: true },
        });
        targetUserIds = allUsers.map((user) => user.id);
        break;

      default:
        throw new Error(`Invalid mode: ${mode}`);
    }

    if (targetUserIds.length === 0) {
      throw new Error('No users found to send notifications to');
    }

    logger.info('Creating bulk notifications', {
      adminId: adminId.toString(),
      mode,
      userCount: targetUserIds.length,
      title,
    });

    // Create notifications for all target users
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ userId: string; error: string }>,
    };

    for (const userId of targetUserIds) {
      try {
        await this.createNotification(adminId, userId, title, message);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          userId: userId.toString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        logger.error('Failed to create notification for user', {
          userId: userId.toString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Bulk notification creation completed', {
      adminId: adminId.toString(),
      mode,
      success: results.success,
      failed: results.failed,
      title,
    });

    return results;
  }
}

export const notificationService = new NotificationService();

/**
 * Helper function to automatically send notifications to users when admin performs actions
 * 
 * This ensures ALL auto-generated notifications are:
 * 1. Saved to database (appears in app)
 * 2. Sent via FCM push (works when app is closed)
 * 
 * This function is called for ALL admin actions (document verification, KYC, policy, etc.)
 */
export async function sendAdminActionNotification(
  adminId: string,
  userId: string,
  actionType: string,
  details?: Record<string, any>
): Promise<void> {
  // Validate inputs
  if (!adminId || !userId || !actionType) {
    logger.error('Invalid parameters for admin action notification', {
      adminId,
      userId,
      actionType,
    });
    return;
  }

  try {
    const title = getNotificationTitle(actionType, details);
    const message = getNotificationMessage(actionType, details);

    // Create notification - this will:
    // 1. Save to database (for in-app display)
    // 2. Send push notification (for when app is closed)
    const notification = await notificationService.createNotification(
      BigInt(adminId),
      BigInt(userId),
      title,
      message
    );

    logger.info('Admin action notification created successfully', {
      adminId,
      userId,
      actionType,
      notificationId: notification.id.toString(),
      title,
      savedToDatabase: true,
      pushSent: true, // Will be true if FCM token exists, false otherwise
    });
  } catch (error) {
    // Log error but don't interrupt main flow
    // However, this should rarely happen as createNotification handles errors internally
    logger.error('CRITICAL: Failed to create admin action notification', {
      adminId,
      userId,
      actionType,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Don't throw - allow admin action to complete even if notification fails
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
    case 'POLICY_PENDING':
      return 'Policy Pending Review';
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
    case 'POLICY_PENDING':
      return `Your policy ${details?.policyNumber || ''} is now pending review. All documents have been verified.`;
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
 * 
 * This function:
 * 1. Checks if Firebase is initialized
 * 2. Gets the user's FCM token
 * 3. Sends push notification via FCM
 * 4. Handles invalid tokens by removing them
 * 
 * Note: This is called AFTER the database record is created,
 * so even if push fails, the notification will still appear in the app.
 */
async function sendPushNotification(
  userId: string,
  title: string,
  message: string,
  notificationId: string
): Promise<void> {
  // Check if Firebase Admin is initialized
  if (!admin.apps.length) {
    logger.warn('Firebase Admin not initialized, skipping push notification', {
      userId,
      notificationId,
    });
    return;
  }

  try {
    // Get FCM token for user
    const fcmToken = await getFCMToken(userId);
    
    if (!fcmToken) {
      logger.debug('No FCM token found for user - notification saved to database only', {
        userId,
        notificationId,
        note: 'User needs to enable push notifications in the app',
      });
      return;
    }

    // Send push notification via FCM
    // This will work even when the app is closed (service worker handles it)
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
        type: 'admin_notification', // Helps identify notification type
      },
      token: fcmToken,
      // Ensure notification is shown even when app is in background or closed
      android: {
        priority: 'high' as const,
        notification: {
          sound: 'default',
          channelId: 'default',
        },
      },
      apns: {
        headers: {
          'apns-priority': '10',
        },
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      webpush: {
        notification: {
          title,
          body: message,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          requireInteraction: false,
        },
        fcmOptions: {
          link: '/notifications',
        },
      },
    };

    const response = await admin.messaging().send(messagePayload);
    logger.info('Push notification sent successfully via FCM', {
      userId,
      notificationId,
      messageId: response,
      fcmToken: fcmToken.substring(0, 20) + '...', // Log partial token for debugging
    });
  } catch (error: any) {
    // Handle specific FCM errors
    if (error.code === 'messaging/invalid-registration-token' || 
        error.code === 'messaging/registration-token-not-registered') {
      // Token is invalid or expired, remove it from user profile
      logger.warn('Invalid or expired FCM token, removing from user profile', {
        userId,
        notificationId,
        errorCode: error.code,
      });
      try {
        await prisma.user.update({
          where: { id: BigInt(userId) },
          data: { device_id: null },
        });
        logger.info('Invalid FCM token removed from user profile', { userId });
      } catch (updateError) {
        logger.error('Failed to remove invalid FCM token from user profile', {
          userId,
          error: updateError instanceof Error ? updateError.message : 'Unknown error',
        });
      }
    } else {
      // Other FCM errors (network, quota, etc.)
      logger.error('Failed to send push notification via FCM', {
        userId,
        notificationId,
        error: error.message || 'Unknown error',
        errorCode: error.code,
        note: 'Notification is still saved to database and will appear in app',
      });
    }
    // Don't throw - database record already exists, so notification will show in app
  }
}


