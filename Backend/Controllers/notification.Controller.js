// controllers/notificationController.js
import { NotificationModel } from "../Models/Notification.Model.js";
import { UserModel } from "../Models/User.Model.js";
import mongoose from "mongoose";

let io;

/**
 * Set Socket IO instance
 */
export const setSocketIO = (socketIO) => {
  io = socketIO;
};

/**
 * Get all notifications for logged-in user
 */
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const notifications = await NotificationModel.find({ receiver: userId })
      .populate("sender", "username fullname profilePic email accountType")
      .populate("postId", "title image content")
      .populate("messageId", "message")
      .populate("chatId", "participants")
      .sort({ createdAt: -1 })
      .limit(100);

    return res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      count: notifications.length,
      notifications
    });

  } catch (error) {
    console.error("❌ Error getting notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching notifications",
      error: error.message
    });
  }
};

/**
 * Get notifications with pagination
 */
export const getNotificationsWithPagination = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { page = 1, limit = 20 } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const skip = (page - 1) * limit;

    const notifications = await NotificationModel.find({ receiver: userId })
      .populate("sender", "username fullname profilePic email")
      .populate("postId", "title image")
      .populate("messageId", "message")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await NotificationModel.countDocuments({ receiver: userId });

    return res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      notifications,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: notifications.length,
        totalNotifications: total
      }
    });

  } catch (error) {
    console.error("❌ Error getting paginated notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching notifications",
      error: error.message
    });
  }
};

/**
 * Get unread notifications count
 */
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const unreadCount = await NotificationModel.countDocuments({
      receiver: userId,
      isRead: false
    });

    return res.status(200).json({
      success: true,
      unreadCount
    });

  } catch (error) {
    console.error("❌ Error getting unread count:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching unread count",
      error: error.message
    });
  }
};

/**
 * Get unread notifications
 */
export const getUnreadNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const unreadNotifications = await NotificationModel.find({
      receiver: userId,
      isRead: false
    })
      .populate("sender", "username fullname profilePic email")
      .populate("postId", "title image")
      .populate("messageId", "message")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: unreadNotifications.length,
      notifications: unreadNotifications
    });

  } catch (error) {
    console.error("❌ Error getting unread notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching unread notifications",
      error: error.message
    });
  }
};

/**
 * Get notifications by type
 */
export const getNotificationsByType = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { type } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const validTypes = ["like", "comment", "reply", "new_post", "new_message", "first_message"];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid type. Valid types: ${validTypes.join(", ")}`
      });
    }

    const notifications = await NotificationModel.find({
      receiver: userId,
      type: type
    })
      .populate("sender", "username fullname profilePic email")
      .populate("postId", "title image")
      .populate("messageId", "message")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      type,
      count: notifications.length,
      notifications
    });

  } catch (error) {
    console.error("❌ Error getting notifications by type:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching notifications",
      error: error.message
    });
  }
};

/**
 * Mark single notification as read
 */
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params; // ✅ CHANGED from notificationId
    const userId = req.user?.id;

    console.log('⏳ Marking as read:', { notificationId: id, userId });

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID"
      });
    }

    const notification = await NotificationModel.findOneAndUpdate(
      {
        _id: id,
        receiver: userId
      },
      {
        isRead: true,
        readAt: new Date()
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found or unauthorized"
      });
    }

    // ✅ EMIT SOCKET EVENT
    if (io) {
      io.to(userId).emit('notificationRead', {
        notificationId: id,
        isRead: true,
        readAt: notification.readAt
      });
      console.log(`✅ Notification ${id} marked as read`);
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      notification
    });

  } catch (error) {
    console.error("❌ Error marking notification as read:", error);
    return res.status(500).json({
      success: false,
      message: "Error marking notification as read",
      error: error.message
    });
  }
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const result = await NotificationModel.updateMany(
      { receiver: userId, isRead: false },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    // ✅ EMIT SOCKET EVENT
    if (io) {
      io.emit('allNotificationsRead', {
        userId: userId,
        readAt: new Date()
      });
      console.log(`✅ All notifications marked as read for user ${userId}`);
    }

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error("❌ Error marking all notifications as read:", error);
    return res.status(500).json({
      success: false,
      message: "Error marking notifications as read",
      error: error.message
    });
  }
};

/**
 * Delete single notification
 */
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params; // ✅ CHANGED from notificationId
    const userId = req.user?.id;

    console.log('🗑️ Deleting notification:', { notificationId: id, userId });

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID format"
      });
    }

    const notification = await NotificationModel.findOneAndDelete(
      {
        _id: id,
        receiver: userId
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found or unauthorized"
      });
    }

    // ✅ EMIT SOCKET EVENT
    if (io) {
      io.to(userId).emit('notificationDeleted', {
        notificationId: id
      });
      console.log(`🗑️ Notification ${id} deleted`);
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
      data: { deletedCount: 1 }
    });

  } catch (error) {
    console.error("❌ Error deleting notification:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting notification",
      error: error.message
    });
  }
};
/**
 * Delete all notifications
 */
export const deleteAllNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const result = await NotificationModel.deleteMany({
      receiver: userId
    });

    // ✅ EMIT SOCKET EVENT
    if (io) {
      io.emit('allNotificationsDeleted', {
        userId: userId
      });
      console.log(`🗑️ All notifications deleted for user ${userId}`);
    }

    return res.status(200).json({
      success: true,
      message: "All notifications deleted successfully",
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error("❌ Error deleting all notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting notifications",
      error: error.message
    });
  }
};

/**
 * Clear unread notifications
 */
export const clearUnread = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const result = await NotificationModel.deleteMany({
      receiver: userId,
      isRead: false
    });

    // ✅ EMIT SOCKET EVENT
    if (io) {
      io.emit('unreadCleared', {
        userId: userId
      });
      console.log(`🗑️ Unread notifications cleared for user ${userId}`);
    }

    return res.status(200).json({
      success: true,
      message: "Unread notifications cleared",
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error("❌ Error clearing unread notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Error clearing notifications",
      error: error.message
    });
  }
};

/**
 * Get notification by ID
 */
export const getNotificationById = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID"
      });
    }

    const notification = await NotificationModel.findOne({
      _id: notificationId,
      receiver: userId
    })
      .populate("sender", "username fullname profilePic email")
      .populate("postId", "title image content")
      .populate("messageId", "message")
      .populate("chatId", "participants");

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    return res.status(200).json({
      success: true,
      notification
    });

  } catch (error) {
    console.error("❌ Error getting notification:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching notification",
      error: error.message
    });
  }
};

/**
 * Get notification stats
 */
export const getNotificationStats = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const total = await NotificationModel.countDocuments({ receiver: userId });
    const unread = await NotificationModel.countDocuments({
      receiver: userId,
      isRead: false
    });

    const byType = await NotificationModel.aggregate([
      { $match: { receiver: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: "$type", count: { $sum: 1 } } }
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        total,
        unread,
        read: total - unread,
        byType: byType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });

  } catch (error) {
    console.error("❌ Error getting notification stats:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching notification stats",
      error: error.message
    });
  }
};

/**
 * Search notifications
 */
export const searchNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { query } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    if (!query || query.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Search query is required"
      });
    }

    const notifications = await NotificationModel.find({
      receiver: userId,
      content: { $regex: query, $options: "i" }
    })
      .populate("sender", "username fullname profilePic")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      notifications
    });

  } catch (error) {
    console.error("❌ Error searching notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Error searching notifications",
      error: error.message
    });
  }
};


