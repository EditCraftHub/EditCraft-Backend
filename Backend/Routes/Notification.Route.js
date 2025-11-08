import express from "express";
import {
  // ❌ Remove createNotification (created by socket server)
  // createNotification,
  
  // ✅ Keep these with correct names
  getUserNotifications,
  getUnreadCount,
  getUnreadNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  getNotificationById,
  getNotificationStats,
  searchNotifications
} from "../Controllers/notification.Controller.js";
import { authMiddleware } from "../Middleware/authMiddleware.js";

export const NotificationRouter = express.Router();

/**
 * GET /get-user-notifications
 * Get all notifications for logged-in user
 */
NotificationRouter.get(
  "/get-user-notifications",
  authMiddleware(["user"]),
  getUserNotifications
);

/**
 * GET /unread-count
 * Get unread notification count (for badge)
 */
NotificationRouter.get(
  "/unread-count",
  authMiddleware(["user"]),
  getUnreadCount
);

/**
 * GET /unread
 * Get all unread notifications
 */
NotificationRouter.get(
  "/unread",
  authMiddleware(["user"]),
  getUnreadNotifications
);

/**
 * GET /stats
 * Get notification statistics
 */
NotificationRouter.get(
  "/stats",
  authMiddleware(["user"]),
  getNotificationStats
);

/**
 * GET /search
 * Search notifications
 * Query: ?query=text
 */
NotificationRouter.get(
  "/search",
  authMiddleware(["user"]),
  searchNotifications
);

/**
 * ✅ IMPORTANT: Specific routes BEFORE :id routes to avoid conflicts
 */

/**
 * PUT /mark-all-as-read
 * Mark ALL notifications as read
 */
NotificationRouter.put(
  "/mark-all-as-read",
  authMiddleware(["user"]),
  markAllAsRead
);

/**
 * DELETE /delete-all
 * Delete all notifications
 */
NotificationRouter.delete(
  "/delete-all",
  authMiddleware(["user"]),
  deleteAllNotifications
);

/**
 * ✅ THEN: ID-based routes
 */

/**
 * GET /:id
 * Get single notification by ID
 */
NotificationRouter.get(
  "/:id",
  authMiddleware(["user"]),
  getNotificationById
);

/**
 * PUT /mark-as-read/:id
 * Mark single notification as read
 */
NotificationRouter.put(
  "/mark-as-read/:id",
  authMiddleware(["user"]),
  markAsRead
);

/**
 * DELETE /delete/:id
 * Delete single notification
 */
NotificationRouter.delete(
  "/delete/:id",
  authMiddleware(["user"]),
  deleteNotification
);

export default NotificationRouter;