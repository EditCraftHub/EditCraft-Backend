import { UserModel } from "../Models/User.Model.js";
import s3 from "../lib/s3.js";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

// ==================== MAIN CONTROLLERS ====================

/**
 * Get all users except the current user
 */
export const getAllUsers = async (req, res) => {
  try {
    // Validate user exists in request
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated"
      });
    }

    const currentUserId = req.user._id;

    // Get current user's blocked users list
    const currentUser = await UserModel.findById(currentUserId).select('blockedUsers').lean();
    const blockedUserIds = currentUser?.blockedUsers || [];

    const users = await UserModel.find({ 
      _id: { 
        $ne: currentUserId,
        $nin: blockedUserIds // Exclude blocked users
      },
      isBanned: { $ne: true }, // Don't show banned users
      blockedUsers: { $ne: currentUserId } // Don't show users who blocked current user
    })
      .select("-password -otp -resetOtp -resetOtpExpires -otpExpires")
      .lean();
      
    // Add isOnline status
    const usersWithStatus = users.map(user => ({
      ...user,
      isOnline: req.onlineUsers?.has(user._id.toString()) || user.isOnline || false,
      status: user.status || 'offline'
    }));

    res.status(200).json({
      success: true,
      count: usersWithStatus.length,
      users: usersWithStatus
    });
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get user by ID
 */
export const getUserById = async (req, res) => {
  try {
    // Validate user authentication
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated"
      });
    }

    const { id } = req.params;

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    const user = await UserModel.findById(id)
      .select('-password -otp -resetOtp -resetOtpExpires -otpExpires')
      .lean();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if user is banned
    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: "This user is not available"
      });
    }

    // Check if blocked
    const currentUser = await UserModel.findById(req.user._id).select('blockedUsers').lean();
    if (currentUser?.blockedUsers?.includes(id)) {
      return res.status(403).json({
        success: false,
        message: "You have blocked this user"
      });
    }

    if (user.blockedUsers?.includes(req.user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: "You cannot view this user's profile"
      });
    }

    // Add online status
    const userWithStatus = {
      ...user,
      isOnline: req.onlineUsers?.has(user._id.toString()) || user.isOnline || false,
      status: user.status || 'offline'
    };

    res.status(200).json({
      success: true,
      user: userWithStatus
    });
    
  } catch (error) {
    console.error("Error in getUserById:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get current user's profile
 */
export const myProfile = async (req, res) => {
  try {
    // Validate user authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated"
      });
    }

    const userId = req.user.id;

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    const myProfile = await UserModel.findById(userId).select('-password -otp -resetOtp -resetOtpExpires -otpExpires');
    
    if (!myProfile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found. Please contact support."
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      yourProfile: myProfile
    });
    
  } catch (error) {
    console.error("Error in myProfile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update current user's profile
 */
export const updateMyProfile = async (req, res) => {
  try {
    // Validate authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated"
      });
    }

    const userId = req.user.id;
    const { fullname, bio } = req.body;
    const profilePicFile = req.files?.profilePic?.[0]; // For profile picture
    const bannerFile = req.files?.banner?.[0]; // For banner

    // Validate at least one field to update
    if (!fullname && !bio && !profilePicFile && !bannerFile) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one field to update"
      });
    }

    let uploadFields = {};

    // Validate and sanitize fullname
    if (fullname) {
      const trimmedName = fullname.trim();
      if (trimmedName.length < 2 || trimmedName.length > 50) {
        return res.status(400).json({
          success: false,
          message: "Full name must be between 2 and 50 characters"
        });
      }
      uploadFields.fullname = trimmedName;
    }

    // Validate and sanitize bio
    if (bio) {
      const trimmedBio = bio.trim();
      if (trimmedBio.length > 500) {
        return res.status(400).json({
          success: false,
          message: "Bio must not exceed 500 characters"
        });
      }
      uploadFields.bio = trimmedBio;
    }

    // Helper function to validate and upload image
    const uploadImage = async (file, type) => {
      // Validate file type
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new Error(`Invalid ${type} file type. Only JPEG, PNG, and WebP images are allowed`);
      }

      // Validate file size (e.g., max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new Error(`${type} file size exceeds 5MB limit`);
      }

      const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `${type}/${userId}-${Date.now()}-${file.originalname}`,
        Body: file.buffer,
        ContentType: file.mimetype,
      };

      console.log(`📤 Uploading ${type} to S3...`);
      const uploadResult = await s3.upload(params).promise();
      console.log(`✅ ${type} upload successful:`, uploadResult.Location);
      
      return uploadResult.Location;
    };

    // Helper function to delete old image from S3
    const deleteOldImage = async (imageUrl, type) => {
      if (!imageUrl) return;
      
      try {
        const urlParts = imageUrl.split('.com/');
        if (urlParts.length > 1) {
          const oldKey = urlParts[1];
          await s3.deleteObject({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: oldKey
          }).promise();
          console.log(`🗑️ Deleted old ${type}:`, oldKey);
        }
      } catch (deleteError) {
        console.error(`⚠️ Error deleting old ${type}:`, deleteError.message);
      }
    };

    // Get user's old images
    const user = await UserModel.findById(userId).select('profilePic banner');

    // Upload profile pic to S3
    if (profilePicFile) {
      try {
        const profilePicUrl = await uploadImage(profilePicFile, 'profile');
        uploadFields.profilePic = profilePicUrl;

        // Delete old profile pic
        await deleteOldImage(user?.profilePic, 'profile pic');
      } catch (error) {
        console.error("❌ Profile Pic Upload Error:", error);
        return res.status(400).json({
          success: false,
          message: error.message || "Failed to upload profile picture"
        });
      }
    }

    // Upload banner to S3
    if (bannerFile) {
      try {
        const bannerUrl = await uploadImage(bannerFile, 'banner');
        uploadFields.banner = bannerUrl;

        // Delete old banner
        await deleteOldImage(user?.banner, 'banner');
      } catch (error) {
        console.error("❌ Banner Upload Error:", error);
        return res.status(400).json({
          success: false,
          message: error.message || "Failed to upload banner"
        });
      }
    }

    const updatedProfile = await UserModel.findByIdAndUpdate(
      userId,
      uploadFields,
      { new: true, runValidators: true }
    ).select('-password -otp -resetOtp -resetOtpExpires -otpExpires');

    if (!updatedProfile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully ✅",
      yourProfile: updatedProfile,
    });
  } catch (error) {
    console.error("Error in updateMyProfile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Follow a user
 */
export const followUser = async (req, res) => {
  try {
    // Validate authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated"
      });
    }

    const userId = req.user.id;
    const targetId = req.params.id;

    // Validate target ID format
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    // Check if trying to follow self
    if (userId === targetId) {
      return res.status(400).json({
        success: false,
        message: "You cannot follow yourself"
      });
    }

    const user = await UserModel.findById(userId);
    const targetUser = await UserModel.findById(targetId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Your account not found"
      });
    }

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if target user is banned
    if (targetUser.isBanned) {
      return res.status(403).json({
        success: false,
        message: "Cannot follow this user"
      });
    }

    // Check if blocked by target user
    if (targetUser.blockedUsers && targetUser.blockedUsers.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: "You cannot follow this user"
      });
    }

    // Check if user has blocked the target
    if (user.blockedUsers && user.blockedUsers.includes(targetId)) {
      return res.status(403).json({
        success: false,
        message: "You have blocked this user. Unblock them first to follow."
      });
    }

    // Check if already following
    if (user.following.includes(targetId)) {
      return res.status(400).json({
        success: false,
        message: "You are already following this user"
      });
    }

    // Use atomic operations to prevent race conditions
    await UserModel.findByIdAndUpdate(userId, {
      $addToSet: { following: targetId }
    });

    await UserModel.findByIdAndUpdate(targetId, {
      $addToSet: { followers: userId }
    });

    // Get updated following count
    const updatedUser = await UserModel.findById(userId).select('following');

    res.status(200).json({
      success: true,
      message: "User followed successfully",
      followingCount: updatedUser.following.length,
    });
  } catch (error) {
    console.error("Error in followUser:", error);
    res.status(500).json({
      success: false,
      message: "Failed to follow user",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Unfollow a user
 */
export const unfollowUser = async (req, res) => {
  try {
    // Validate authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated"
      });
    }

    const userId = req.user.id;
    const targetId = req.params.id;

    // Validate target ID format
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    // Check if trying to unfollow self
    if (userId === targetId) {
      return res.status(400).json({
        success: false,
        message: "You cannot unfollow yourself"
      });
    }

    const user = await UserModel.findById(userId);
    const targetUser = await UserModel.findById(targetId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Your account not found"
      });
    }

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if not following
    if (!user.following.includes(targetId)) {
      return res.status(400).json({
        success: false,
        message: "You are not following this user"
      });
    }

    // Use atomic operations
    await UserModel.findByIdAndUpdate(userId, {
      $pull: { following: targetId }
    });

    await UserModel.findByIdAndUpdate(targetId, {
      $pull: { followers: userId }
    });

    // Get updated following count
    const updatedUser = await UserModel.findById(userId).select('following');

    res.status(200).json({
      success: true,
      message: "User unfollowed successfully",
      followingCount: updatedUser.following.length,
    });
  } catch (error) {
    console.error("Error in unfollowUser:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unfollow user",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Block a user
 */
export const blockUser = async (req, res) => {
  try {
    // Validate authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated"
      });
    }

    const userId = req.user.id;
    const targetId = req.params.id;

    // Validate target ID format
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    // Check if trying to block self
    if (userId === targetId) {
      return res.status(400).json({
        success: false,
        message: "You cannot block yourself"
      });
    }

    const user = await UserModel.findById(userId);
    const targetUser = await UserModel.findById(targetId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Your account not found"
      });
    }

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if already blocked
    if (user.blockedUsers && user.blockedUsers.includes(targetId)) {
      return res.status(400).json({
        success: false,
        message: "User is already blocked"
      });
    }

    // Use atomic operations
    await UserModel.findByIdAndUpdate(userId, {
      $addToSet: { blockedUsers: targetId },
      $pull: { following: targetId, followers: targetId }
    });

    await UserModel.findByIdAndUpdate(targetId, {
      $pull: { following: userId, followers: userId }
    });

    res.status(200).json({
      success: true,
      message: "User blocked successfully ✅"
    });
  } catch (error) {
    console.error("Error in blockUser:", error);
    res.status(500).json({
      success: false,
      message: "Failed to block user",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Unblock a user
 */
export const unblockUser = async (req, res) => {
  try {
    // Validate authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated"
      });
    }

    const userId = req.user.id;
    const targetId = req.params.id;

    // Validate target ID format
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    const user = await UserModel.findById(userId);
    const targetUser = await UserModel.findById(targetId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Your account not found"
      });
    }

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if not blocked
    if (!user.blockedUsers || !user.blockedUsers.includes(targetId)) {
      return res.status(400).json({
        success: false,
        message: "User is not blocked"
      });
    }

    // Use atomic operation
    await UserModel.findByIdAndUpdate(userId, {
      $pull: { blockedUsers: targetId }
    });

    res.status(200).json({
      success: true,
      message: "User unblocked successfully ✅"
    });
  } catch (error) {
    console.error("Error in unblockUser:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unblock user",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get blocked users list
 */
export const getBlockedUsers = async (req, res) => {
  try {
    // Validate authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated"
      });
    }

    const userId = req.user.id;

    const user = await UserModel.findById(userId)
      .select('blockedUsers')
      .populate('blockedUsers', 'fullname email profilePic username')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      count: user.blockedUsers?.length || 0,
      blockedUsers: user.blockedUsers || []
    });
  } catch (error) {
    console.error("Error in getBlockedUsers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch blocked users",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ==================== STATUS & ACTIVITY CONTROLLERS ====================

/**
 * Set user status (online, away, busy, offline)
 */
export const setUserStatus = async (req, res) => {
  try {
    // Validate authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated"
      });
    }

    const userId = req.user.id;
    const { status } = req.body;

    const validStatuses = ['online', 'offline', 'away', 'busy'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const user = await UserModel.findByIdAndUpdate(
      userId,
      {
        status,
        isOnline: status === 'online',
        lastSeen: new Date()
      },
      { new: true }
    ).select('-password -otp -resetOtp -resetOtpExpires -otpExpires');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Status updated successfully",
      status: user.status,
      isOnline: user.isOnline
    });
  } catch (error) {
    console.error("Error in setUserStatus:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update status",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all online users
 */
export const getOnlineUsers = async (req, res) => {
  try {
    // Validate authentication
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated"
      });
    }

    const users = await UserModel.find({ 
      isOnline: true,
      isBanned: { $ne: true },
      _id: { $ne: req.user._id }
    })
      .select('fullname email profilePic username status isOnline lastSeen')
      .sort({ lastSeen: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error("Error in getOnlineUsers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch online users",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get specific user's online status
 */
export const getUserOnlineStatus = async (req, res) => {
  try {
    // Validate authentication
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated"
      });
    }

    const { id } = req.params;

    // Validate user ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    const user = await UserModel.findById(id)
      .select('isOnline status lastSeen')
      .lean();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      userId: id,
      isOnline: user.isOnline || false,
      status: user.status || 'offline',
      lastSeen: user.lastSeen
    });
  } catch (error) {
    console.error("Error in getUserOnlineStatus:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user status",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Admin: Manually trigger inactive user check
 */
export const checkInactiveUsersController = async (req, res) => {
  try {
    // Validate authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated"
      });
    }

    // Optional: Check if user is admin
    // if (!req.user.isAdmin) {
    //   return res.status(403).json({
    //     success: false,
    //     message: "Forbidden: Admin access required"
    //   });
    // }

    const result = await checkInactiveUsers();

    res.status(200).json({
      success: true,
      message: "Inactive users check completed",
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("Error in checkInactiveUsersController:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check inactive users",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Set user online status
 */
export const setUserOnline = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID format');
    }

    const user = await UserModel.findByIdAndUpdate(
      userId,
      {
        isOnline: true,
        status: 'online',
        lastSeen: new Date()
      },
      { new: true }
    );

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  } catch (error) {
    console.error('Error setting user online:', error);
    throw error;
  }
};

/**
 * Set user offline status
 */
export const setUserOffline = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID format');
    }

    const user = await UserModel.findByIdAndUpdate(
      userId,
      {
        isOnline: false,
        status: 'offline',
        lastSeen: new Date()
      },
      { new: true }
    );

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  } catch (error) {
    console.error('Error setting user offline:', error);
    throw error;
  }
};

/**
 * Update user last seen timestamp
 */
export const updateLastSeen = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID format');
    }

    await UserModel.findByIdAndUpdate(
      userId,
      { lastSeen: new Date() },
      { new: true }
    );
  } catch (error) {
    console.error('Error updating last seen:', error);
    // Don't throw - this is a non-critical operation
  }
};

/**
 * Set user status (online, away, busy, offline) - Helper
 */
export const setUserStatusHelper = async (userId, status) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID format');
    }

    const validStatuses = ['online', 'offline', 'away', 'busy'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const user = await UserModel.findByIdAndUpdate(
      userId,
      {
        status,
        isOnline: status === 'online',
        lastSeen: new Date()
      },
      { new: true }
    );

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  } catch (error) {
    console.error('Error setting user status:', error);
    throw error;
  }
};

/**
 * Get all online users (Helper)
 */
export const getOnlineUsersHelper = async () => {
  try {
    const users = await UserModel.find({ 
      isOnline: true,
      isBanned: { $ne: true }
    })
      .select('-password -otp -resetOtp -resetOtpExpires -otpExpires')
      .sort({ lastSeen: -1 })
      .lean();
    
    return users;
  } catch (error) {
    console.error('Error fetching online users:', error);
    return [];
  }
};

/**
 * Check for inactive users and mark them offline
 * Users inactive for more than 5 minutes will be marked offline
 */
export const checkInactiveUsers = async () => {
  try {
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes
    const cutoffTime = new Date(Date.now() - inactiveThreshold);
    
    const result = await UserModel.updateMany(
      {
        isOnline: true,
        lastSeen: { $lt: cutoffTime }
      },
      {
        isOnline: false,
        status: 'offline'
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`Marked ${result.modifiedCount} inactive user(s) as offline`);
    }
    
    return result;
  } catch (error) {
    console.error('Error checking inactive users:', error);
    throw error;
  }
};

/**
 * Get user's online status (Helper)
 */
export const getUserOnlineStatusHelper = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID format');
    }

    const user = await UserModel.findById(userId)
      .select('isOnline status lastSeen')
      .lean();
    
    if (!user) {
      throw new Error('User not found');
    }

    return user;
  } catch (error) {
    console.error('Error getting user online status:', error);
    return null;
  }
};

// ==================== SCHEDULED JOB ====================

/**
 * Start the inactive user checker
 * Call this in your server startup (e.g., in server.js or app.js)
 */
export const startInactiveUserChecker = () => {
  const INTERVAL = 5 * 60 * 1000; // 5 minutes
  
  // Run immediately on start
  checkInactiveUsers().catch(err => 
    console.error('Initial inactive user check failed:', err)
  );
  
  // Then run periodically
  const intervalId = setInterval(async () => {
    try {
      await checkInactiveUsers();
    } catch (error) {
      console.error('Scheduled inactive user check failed:', error);
    }
  }, INTERVAL);
  
  console.log('✅ Inactive user checker started (runs every 5 minutes)');
  
  // Return interval ID so it can be cleared if needed
  return intervalId;
};