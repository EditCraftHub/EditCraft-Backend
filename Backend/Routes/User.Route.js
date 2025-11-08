import express from "express";
import { authMiddleware } from "../Middleware/authMiddleware.js";
import  upload  from "../Middleware/uploadMiddleware.js";
import {
  // Profile
  myProfile,
  updateMyProfile,

  // Users
  getAllUsers,

  // Follow / Unfollow
  followUser,
  unfollowUser,

  // Block / Unblock
  blockUser,
  unblockUser,

  // Status & Activity (removed from routes, used internally)
  getUserOnlineStatus,
} from "../Controllers/User.controller.js";

export const UserRouter = express.Router();

// ==================== PROFILE ROUTES ====================

/**
 * @route   GET /api/users/me
 * @desc    Get logged-in user profile
 * @access  Private (User)
 */
UserRouter.get("/me", authMiddleware(["user"]), myProfile);

/**
 * @route   PUT /api/users/update-profile
 * @desc    Update profile (with optional profile picture upload)
 * @access  Private (User)
 */
UserRouter.put(
  "/update-profile",
  authMiddleware(["user"]),
  upload.fields([
    { name: 'profilePic', maxCount: 1 },
    { name: 'banner', maxCount: 1 }
  ]), // ✅ Changed from upload.single("profilePic")
  updateMyProfile
);


// ==================== USER ROUTES ====================

/**
 * @route   GET /api/users/all
 * @desc    Get all users except current user
 * @access  Private (User)
 */
UserRouter.get("/all", authMiddleware(["user"]), getAllUsers);

/**
 * @route   GET /api/users/:id
 * @desc    Get specific user profile by ID
 * @access  Private (User)
 */
UserRouter.get("/:id", authMiddleware(["user"]), async (req, res) => {
  try {
    const { UserModel } = await import("../Models/User.Model.js");
    const mongoose = await import("mongoose");

    const userId = req.params.id;

    // Validate ID format
    if (!mongoose.default.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    const user = await UserModel.findById(userId)
      .select("-password -otp -resetOtp -resetOtpExpires -otpExpires");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if blocked
    if (req.user?.blockedUsers?.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: "You have blocked this user"
      });
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user"
    });
  }
});

// ==================== FOLLOW / UNFOLLOW ROUTES ====================

/**
 * @route   POST /api/users/follow/:id
 * @desc    Follow a user
 * @access  Private (User)
 */
UserRouter.post("/follow/:id", authMiddleware(["user"]), followUser);

/**
 * @route   POST /api/users/unfollow/:id
 * @desc    Unfollow a user
 * @access  Private (User)
 */
UserRouter.post("/unfollow/:id", authMiddleware(["user"]), unfollowUser);

// ==================== BLOCK / UNBLOCK ROUTES ====================

/**
 * @route   POST /api/users/block/:id
 * @desc    Block a user
 * @access  Private (User) - NOT admin only
 */
UserRouter.post("/block/:id", authMiddleware(["user"]), blockUser);

/**
 * @route   POST /api/users/unblock/:id
 * @desc    Unblock a user
 * @access  Private (User) - NOT admin only
 */
UserRouter.post("/unblock/:id", authMiddleware(["user"]), unblockUser);

// ==================== STATUS & ACTIVITY ROUTES ====================

/**
 * @route   GET /api/users/status/:id
 * @desc    Get a user's online status
 * @access  Private (User)
 */
UserRouter.get("/status/:id", authMiddleware(["user"]), async (req, res) => {
  try {
    const status = await getUserOnlineStatus(req.params.id);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      status
    });
  } catch (error) {
    console.error("Error getting user status:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch user status"
    });
  }
});

/**
 * @route   GET /api/users/online
 * @desc    Get all online users
 * @access  Private (User)
 */
UserRouter.get("/online", authMiddleware(["user"]), async (req, res) => {
  try {
    const { getOnlineUsers } = await import("../Controllers/User.controller.js");
    const onlineUsers = await getOnlineUsers();

    res.status(200).json({
      success: true,
      count: onlineUsers.length,
      users: onlineUsers
    });
  } catch (error) {
    console.error("Error fetching online users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch online users"
    });
  }
});

/**
 * @route   PUT /api/users/status
 * @desc    Set custom status (online, away, busy, offline)
 * @access  Private (User)
 */
UserRouter.put("/status", authMiddleware(["user"]), async (req, res) => {
  try {
    const { setUserStatus } = await import("../Controllers/User.controller.js");
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required"
      });
    }

    const validStatuses = ['online', 'offline', 'away', 'busy'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    await setUserStatus(req.user.id, status);

    res.status(200).json({
      success: true,
      message: "Status updated successfully",
      status
    });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update status"
    });
  }
});

// ==================== ADMIN ROUTES ====================

/**
 * @route   POST /api/users/admin/check-inactive
 * @desc    Manually trigger inactive user check
 * @access  Private (Admin only)
 */
UserRouter.post("/admin/check-inactive", authMiddleware(["admin"]), async (req, res) => {
  try {
    const { checkInactiveUsers } = await import("../Controllers/User.controller.js");
    const result = await checkInactiveUsers();

    res.status(200).json({
      success: true,
      message: "Inactive users checked successfully",
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("Error checking inactive users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check inactive users"
    });
  }
});

// ==================== NOTES ====================
// 
// ❌ REMOVED ROUTES (Should NOT be HTTP endpoints):
// - PUT /status/online - Use Socket.io connection event
// - PUT /status/offline - Use Socket.io disconnect event
// - PUT /update-last-seen - Use middleware automatically
// - GET /start-inactive-checker - Call in server.js startup
//
// These should be handled automatically by:
// 1. Socket.io events (online/offline)
// 2. Authentication middleware (last seen)
// 3. Server initialization (background job)
//