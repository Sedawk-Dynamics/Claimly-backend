import { Response, NextFunction } from "express";
import { notificationService } from "../services/notification.service";
import { ValidationError } from "../utils/errors";
import { AdminRequest } from "../middlewares/adminAuth.middleware";
import { AuthRequest } from "../middlewares/auth.middleware";

export const createNotification = async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const adminId = req.admin?.adminId;
    const { user_id, title, message, mode, user_ids, count } = req.body;

    if (!adminId) {
      throw new ValidationError("Admin authentication required");
    }

    if (!title || !message) {
      throw new ValidationError("title and message are required");
    }

    // Support both old format (single user) and new format (bulk with mode)
    // If mode is provided, use bulk notification
    if (mode) {
      // Validate mode
      if (!['single', 'all', 'count', 'selected'].includes(mode)) {
        throw new ValidationError("Invalid mode. Must be 'single', 'all', 'count', or 'selected'");
      }

      // Validate mode-specific requirements
      let userIdsForMode: string[] | undefined;
      
      if (mode === 'single') {
        // For single mode, use user_id or first item from user_ids
        if (user_id) {
          userIdsForMode = [user_id];
        } else if (user_ids && user_ids.length > 0) {
          userIdsForMode = user_ids;
        } else {
          throw new ValidationError("user_id or user_ids is required for single mode");
        }
      } else if (mode === 'selected') {
        if (!user_ids || user_ids.length === 0) {
          throw new ValidationError("user_ids array is required for selected mode");
        }
        userIdsForMode = user_ids;
      } else if (mode === 'count') {
        if (!count || count <= 0) {
          throw new ValidationError("count must be a positive number for count mode");
        }
      }
      // For 'all' mode, no additional validation needed

      const results = await notificationService.createBulkNotifications(
        BigInt(adminId),
        title,
        message,
        mode as 'single' | 'all' | 'count' | 'selected',
        userIdsForMode,
        count
      );

      res.status(201).json({
        success: true,
        data: {
          mode,
          totalUsers: results.success + results.failed,
          success: results.success,
          failed: results.failed,
          errors: results.errors,
        },
      });
    } else {
      // Old format: single user notification (backward compatibility)
      if (!user_id) {
        throw new ValidationError("user_id is required for single user notification");
      }

      const notification = await notificationService.createNotification(
        BigInt(adminId),
        BigInt(user_id),
        title,
        message
      );

      // Convert BigInt values to strings for JSON serialization
      const responseData = {
        id: notification.id.toString(),
        admin_id: notification.admin_id.toString(),
        user_id: notification.user_id.toString(),
        title: notification.title,
        message: notification.message,
        is_read: notification.is_read,
        created_at: notification.created_at,
      };

      res.status(201).json({ success: true, data: responseData });
    }
  } catch (error) {
    next(error);
  }
};

export const listUserNotifications = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw new ValidationError("User authentication required");
    }

    const notifications = await notificationService.listUserNotifications(BigInt(userId));

    // Convert BigInt values to strings for JSON serialization
    const responseData = notifications.map((notification) => ({
      id: notification.id.toString(),
      admin_id: notification.admin_id.toString(),
      user_id: notification.user_id.toString(),
      title: notification.title,
      message: notification.message,
      is_read: notification.is_read,
      created_at: notification.created_at,
    }));

    res.json({ success: true, data: responseData });
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      throw new ValidationError("User authentication required");
    }

    if (!id) {
      throw new ValidationError("Notification id is required");
    }

    await notificationService.markAsRead(BigInt(userId), BigInt(id));

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      throw new ValidationError("User authentication required");
    }

    if (!id) {
      throw new ValidationError("Notification id is required");
    }

    const result = await notificationService.deleteNotification(BigInt(userId), BigInt(id));

    if (result.count === 0) {
      throw new ValidationError("Notification not found or you don't have permission to delete it");
    }

    res.json({ success: true, message: "Notification deleted successfully" });
  } catch (error) {
    next(error);
  }
};


