import { Router } from "express";
import { createNotification, listUserNotifications, markNotificationRead, deleteNotification } from "../controllers/notification.controller";
import { authenticateAdmin } from "../middlewares/adminAuth.middleware";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

// Admin creates notification for a user
router.post("/admin/notifications", authenticateAdmin, createNotification);

// User routes
router.get("/notifications", authenticate, listUserNotifications);
router.patch("/notifications/:id/read", authenticate, markNotificationRead);
router.delete("/notifications/:id", authenticate, deleteNotification);

export default router;


