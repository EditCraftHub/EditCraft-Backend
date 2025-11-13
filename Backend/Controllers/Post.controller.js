import { PostModel } from "../Models/Post.Model.js";
import { UserModel } from "../Models/User.Model.js";
import { NotificationModel } from "../Models/Notification.Model.js";
import mongoose from "mongoose";
import s3 from "../lib/s3.js";

// Helper function to validate ObjectId
const isValidObjectId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

// Helper function to sanitize text
const sanitizeText = (text) => {
  return text.trim().substring(0, 500);
};

// ============ EXISTING ENDPOINTS (createPost, getAllPosts, etc.) ============

export const createPost = async (req, res) => {
  try {
    const { title, description, jobDuration, jobType, priceAmount, priceCurrency, tags } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to create a post"
      });
    }

    const userExists = await UserModel.findById(userId);
    if (!userExists) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title is required"
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: "Description is required"
      });
    }

    if (!priceAmount || priceAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Price amount must be greater than 0"
      });
    }

    if (!priceCurrency) {
      return res.status(400).json({
        success: false,
        message: "Currency is required"
      });
    }

    const validJobTypes = ['freelance', 'part-time', 'full-time', 'contract'];
    if (jobType && !validJobTypes.includes(jobType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job type"
      });
    }

    const validCurrencies = ['INR', 'USD', 'EUR', 'GBP'];
    if (!validCurrencies.includes(priceCurrency)) {
      return res.status(400).json({
        success: false,
        message: "Invalid currency"
      });
    }

    const postData = {
      title: sanitizeText(title),
      description: sanitizeText(description),
      jobDuration: jobDuration ? sanitizeText(jobDuration) : "",
      jobType: jobType || "freelance",
      price: {
        amount: Number(priceAmount),
        currency: priceCurrency
      },
      tags: tags 
        ? tags.split(',')
            .map(tag => tag.trim().replace(/"/g, '').toLowerCase())
            .filter(tag => tag.length > 0)
            .slice(0, 10)
        : [],
      userId: userId
    };

    if (req.files?.image) {
      if (req.files.image.length > 5) {
        return res.status(400).json({
          success: false,
          message: "Maximum 5 images allowed"
        });
      }

      postData.image = [];
      for (const file of req.files.image) {
        if (!file.mimetype.startsWith('image/')) {
          return res.status(400).json({
            success: false,
            message: "Invalid file type. Only images allowed"
          });
        }

        if (file.size > 5 * 1024 * 1024) {
          return res.status(400).json({
            success: false,
            message: "Image size must be less than 5MB"
          });
        }

        try {
          const imageParams = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: `posts/images/${Date.now()}-${Math.random()}-${file.originalname}`,
            Body: file.buffer,
            ContentType: file.mimetype
          };
          const uploaded = await s3.upload(imageParams).promise();
          const publicUrl = `${process.env.R2_PUBLIC_URL}/${imageParams.Key}`;
          postData.image.push(publicUrl);
        } catch (s3Error) {
          console.error("S3 Upload Error:", s3Error);
          return res.status(500).json({
            success: false,
            message: "Failed to upload image"
          });
        }
      }
    }

    if (req.files?.video) {
      if (req.files.video.length > 3) {
        return res.status(400).json({
          success: false,
          message: "Maximum 3 videos allowed"
        });
      }

      postData.video = [];
      for (const file of req.files.video) {
        if (!file.mimetype.startsWith('video/')) {
          return res.status(400).json({
            success: false,
            message: "Invalid file type. Only videos allowed"
          });
        }

        if (file.size > 50 * 1024 * 1024) {
          return res.status(400).json({
            success: false,
            message: "Video size must be less than 50MB"
          });
        }

        try {
          const videoParams = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: `posts/videos/${Date.now()}-${Math.random()}-${file.originalname}`,
            Body: file.buffer,
            ContentType: file.mimetype
          };
          const uploaded = await s3.upload(videoParams).promise();
          const publicUrl = `${process.env.R2_PUBLIC_URL}/${videoParams.Key}`;
          postData.video.push(publicUrl);
        } catch (s3Error) {
          console.error("S3 Upload Error:", s3Error);
          return res.status(500).json({
            success: false,
            message: "Failed to upload video"
          });
        }
      }
    }

    const newPost = await PostModel.create(postData);
    await newPost.populate("userId", "fullname profilePic email username");
    await newPost.populate("comments.userId", "fullname profilePic username");
    await newPost.populate("comments.replies.userId", "fullname profilePic username");

    res.status(201).json({
      success: true,
      message: "Post created successfully ✅",
      post: newPost
    });

  } catch (error) {
    console.error("Create Post Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getAllPosts = async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;

    if (page < 1) page = 1;
    if (limit < 1 || limit > 50) limit = 10;

    const skip = (page - 1) * limit;

    const posts = await PostModel.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "fullname profilePic email username")
      .populate("comments.userId", "fullname profilePic username")
      .populate("comments.replies.userId", "fullname profilePic username");

    const totalPosts = await PostModel.countDocuments();
    const totalPages = Math.ceil(totalPosts / limit);

    res.status(200).json({
      success: true,
      message: "All posts fetched successfully ✅",
      pagination: {
        currentPage: page,
        totalPages,
        totalPosts,
        limit
      },
      posts,
    });

  } catch (error) {
    console.error("Get All Posts Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// In Post.controller.js - Update this function:

export const getSinglePost = async (req, res) => {
  try {
    const { id } = req.params; // ✅ Changed from postId to id

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID format"
      });
    }

    const post = await PostModel.findById(id)
      .populate("userId", "fullname profilePic email username")
      .populate("comments.userId", "fullname profilePic username")
      .populate("comments.replies.userId", "fullname profilePic username");

    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: "Post not found" 
      });
    }

    res.status(200).json({
      success: true,
      message: "Post fetched successfully ✅",
      post
    });

  } catch (error) {
    console.error("Get Single Post Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getMyPosts = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to view your posts"
      });
    }

    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;

    if (page < 1) page = 1;
    if (limit < 1 || limit > 50) limit = 10;

    const skip = (page - 1) * limit;

    const posts = await PostModel.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "fullname profilePic email username")
      .populate("comments.userId", "fullname profilePic username")
      .populate("comments.replies.userId", "fullname profilePic username");

    const totalPosts = await PostModel.countDocuments({ userId });
    const totalPages = Math.ceil(totalPosts / limit);

    res.status(200).json({
      success: true,
      message: "Your posts fetched successfully ✅",
      pagination: {
        currentPage: page,
        totalPages,
        totalPosts,
        limit
      },
      posts,
    });

  } catch (error) {
    console.error("Get My Posts Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const deleteMyPost = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id: postId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to delete a post"
      });
    }

    if (!isValidObjectId(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID format"
      });
    }

    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const post = await PostModel.findById(postId);
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: "Post not found" 
      });
    }

    if (post.userId.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: "You are not authorized to delete this post" 
      });
    }

    const deleteS3File = async (url) => {
      if (!url) return;
      try {
        const key = url.split(`/${process.env.AWS_BUCKET_NAME}/`)[1] || url.split('/').slice(-2).join('/');
        await s3.deleteObject({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: key,
        }).promise();
      } catch (err) {
        console.error("S3 Delete Error:", err);
      }
    };

    if (post.image && Array.isArray(post.image) && post.image.length > 0) {
      for (const imageUrl of post.image) {
        await deleteS3File(imageUrl);
      }
    }

    if (post.video && Array.isArray(post.video) && post.video.length > 0) {
      for (const videoUrl of post.video) {
        await deleteS3File(videoUrl);
      }
    }

    await PostModel.findByIdAndDelete(postId);

    res.status(200).json({ 
      success: true, 
      message: "Post deleted successfully ✅" 
    });

  } catch (error) {
    console.error("Delete Post Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const toggleLikePost = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id: postId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to like a post"
      });
    }

  if (!mongoose.Types.ObjectId.isValid(postId) || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid post or user ID"
    })
  }

    const userExists = await UserModel.findById(userId);
    if (!userExists) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const post = await PostModel.findById(postId)
      .populate("userId", "fullname profilePic email username")
      .populate("comments.userId", "fullname profilePic username")
      .populate("comments.replies.userId", "fullname profilePic username");

    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: "Post not found" 
      });
    }

    const likedIndex = post.likes.indexOf(userId);
    let isLiked = false;

    if (likedIndex > -1) {
      post.likes.splice(likedIndex, 1);
      isLiked = false;
    } else {
      post.likes.push(userId);
      isLiked = true;
    }

    await post.save();
   // ==========================================
    // 🔔 CREATE REAL-TIME LIKE NOTIFICATION HERE
    // ==========================================
    if (isLiked && post.userId._id.toString() !== userId.toString()) {
      const io = req.app.get("io");

      // Create a notification document
      const notification = new NotificationModel({
        sender: userId,
        receiver: post.userId._id,
        type: "like",
        postId,
        content: `${userExists.fullname} liked your post ❤️`,
      });

      await notification.save();
      await notification.populate("sender", "username fullname profilePic");

      // Emit only to the receiver
      if (io) {
        io.to(post.userId._id.toString()).emit("notification", {
          _id: notification._id,
          type: notification.type,
          sender: notification.sender,
          content: notification.content,
          postId: notification.postId,
          createdAt: notification.createdAt,
          isRead: false,
        });
      }
    }
    // ==========================================


    res.status(200).json({ 
      success: true, 
      message: isLiked ? "Post liked ✅" : "Post unliked ✅", 
      post,
      likesCount: post.likes.length,
      isLiked
    });
  } catch (error) {
    console.error("Toggle Like Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ✅ ADD COMMENT
export const addComment = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id: postId } = req.params;
    const { text } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to comment"
      });
    }

    if (!isValidObjectId(postId) || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format"
      });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: "Comment text is required" 
      });
    }

    if (text.trim().length > 500) {
      return res.status(400).json({ 
        success: false, 
        message: "Comment must be less than 500 characters" 
      });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const post = await PostModel.findById(postId);
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: "Post not found" 
      });
    }

    const comment = { 
      userId, 
      text: sanitizeText(text),
      likes: [],
      replies: [],
      createdAt: new Date()
    };

    post.comments.push(comment);
    await post.save();

    await post.populate("userId", "fullname profilePic email username");
    await post.populate("comments.userId", "fullname profilePic username");
    await post.populate("comments.replies.userId", "fullname profilePic username");

    // ======================================================
    // 🔔 CREATE REAL-TIME COMMENT NOTIFICATION
    // ======================================================
    if (post.userId._id.toString() !== userId.toString()) {
      const io = req.app.get("io");

      const notification = new NotificationModel({
        sender: userId,
        receiver: post.userId._id,
        type: "comment",
        postId,
        content: `${user.fullname} commented: "${text.substring(0, 50)}..."`,
      });

      await notification.save();
      await notification.populate("sender", "fullname profilePic username");

      if (io) {
        io.to(post.userId._id.toString()).emit("notification", {
          _id: notification._id,
          sender: notification.sender,
          type: notification.type,
          postId: notification.postId,
          content: notification.content,
          createdAt: notification.createdAt,
          isRead: false,
        });
      }
    }
    // ======================================================

    res.status(201).json({ 
      success: true, 
      message: "Comment added successfully ✅", 
      post,
      commentsCount: post.comments.length
    });

  } catch (error) {
    console.error("Add Comment Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ✅ DELETE COMMENT
export const deleteComment = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { postId, commentId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to delete a comment"
      });
    }

    if (!isValidObjectId(postId) || !isValidObjectId(commentId) || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format"
      });
    }

    const post = await PostModel.findById(postId);
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: "Post not found" 
      });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ 
        success: false, 
        message: "Comment not found" 
      });
    }

    if (comment.userId.toString() !== userId && post.userId.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: "You are not authorized to delete this comment" 
      });
    }

    post.comments.pull(commentId);
    await post.save();

    await post.populate("userId", "fullname profilePic email username");
    await post.populate("comments.userId", "fullname profilePic username");
    await post.populate("comments.replies.userId", "fullname profilePic username");

    res.status(200).json({ 
      success: true, 
      message: "Comment deleted successfully ✅", 
      post,
      commentsCount: post.comments.length
    });

  } catch (error) {
    console.error("Delete Comment Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const likeComment = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { postId, commentId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to like a comment"
      });
    }

    if (!isValidObjectId(postId) || !isValidObjectId(commentId) || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format"
      });
    }

    // ✅ Fetch user early
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const post = await PostModel.findById(postId);
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: "Post not found" 
      });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ 
        success: false, 
        message: "Comment not found" 
      });
    }

    const likedIndex = comment.likes.indexOf(userId);
    let isLiked = false;

    if (likedIndex > -1) {
      comment.likes.splice(likedIndex, 1);
      isLiked = false;
      
      // ✅ Delete notification on unlike
      await NotificationModel.findOneAndDelete({
        sender: userId,
        receiver: comment.userId,
        type: "like",
        postId
      });
    } else {
      comment.likes.push(userId);
      isLiked = true;
      
      // ✅ Create notification on like
      if (comment.userId.toString() !== userId.toString()) {
        try {
          const notification = new NotificationModel({
            sender: userId,
            receiver: comment.userId,
            type: "like",
            postId,
            content: `${user.fullname} liked your comment ❤️`, // ✅ Now 'user' exists
          });

          await notification.save();
          await notification.populate("sender", "fullname profilePic username");

          const io = req.app.get("io");
          if (io) {
            io.to(comment.userId.toString()).emit("notification", {
              _id: notification._id,
              sender: notification.sender,
              type: notification.type,
              postId: notification.postId,
              content: notification.content,
              createdAt: notification.createdAt,
              isRead: false,
            });
          }
        } catch (notificationError) {
          console.error("Notification creation failed:", notificationError);
          // Continue with response even if notification fails
        }
      }
    }

    await post.save();

    await post.populate("userId", "fullname profilePic email username");
    await post.populate("comments.userId", "fullname profilePic username");
    await post.populate("comments.replies.userId", "fullname profilePic username");

    res.status(200).json({ 
      success: true, 
      message: isLiked ? "Comment liked ✅" : "Comment unliked ✅",
      post,
      isLiked,
      commentLikesCount: comment.likes.length
    });

  } catch (error) {
    console.error("Like Comment Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};




// ✅ ADD REPLY TO COMMENT + SOCKET NOTIFICATION
export const addReply = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { postId, commentId } = req.params;
    const { text } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to reply",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(postId) ||
      !mongoose.Types.ObjectId.isValid(commentId) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reply text is required",
      });
    }

    if (text.trim().length > 500) {
      return res.status(400).json({
        success: false,
        message: "Reply must be less than 500 characters",
      });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const post = await PostModel.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    const reply = {
      userId,
      text: sanitizeText(text),
      likes: [],
      createdAt: new Date(),
    };

    comment.replies.push(reply);
    await post.save();

    await post.populate("userId", "fullname profilePic email username");
    await post.populate("comments.userId", "fullname profilePic username");
    await post.populate("comments.replies.userId", "fullname profilePic username");

    // ======================================================
    // 🔔 CREATE REAL-TIME REPLY NOTIFICATION
    // ======================================================
    if (comment.userId.toString() !== userId.toString()) {
      const io = req.app.get("io");

      const notification = new NotificationModel({
        sender: userId,
        receiver: comment.userId,
        type: "reply",
        postId,
        content: `${user.fullname} replied: "${text.substring(0, 50)}..."`,
      });

      await notification.save();
      await notification.populate("sender", "fullname profilePic username");

      if (io) {
        io.to(comment.userId.toString()).emit("notification", {
          _id: notification._id,
          sender: notification.sender,
          type: notification.type,
          postId: notification.postId,
          content: notification.content,
          createdAt: notification.createdAt,
          isRead: false,
        });
      }
    }
    // ======================================================

    res.status(201).json({
      success: true,
      message: "Reply added successfully ✅",
      post,
      repliesCount: comment.replies.length,
    });
  } catch (error) {
    console.error("Add Reply Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


// ✅ DELETE REPLY
export const deleteReply = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { postId, commentId, replyId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to delete a reply"
      });
    }

    if (!isValidObjectId(postId) || !isValidObjectId(commentId) || !isValidObjectId(replyId) || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format"
      });
    }

    const post = await PostModel.findById(postId);
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: "Post not found" 
      });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ 
        success: false, 
        message: "Comment not found" 
      });
    }

    const reply = comment.replies.id(replyId);
    if (!reply) {
      return res.status(404).json({ 
        success: false, 
        message: "Reply not found" 
      });
    }

    if (reply.userId.toString() !== userId && post.userId.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: "You are not authorized to delete this reply" 
      });
    }

    comment.replies.pull(replyId);
    await post.save();

    await post.populate("userId", "fullname profilePic email username");
    await post.populate("comments.userId", "fullname profilePic username");
    await post.populate("comments.replies.userId", "fullname profilePic username");

    res.status(200).json({ 
      success: true, 
      message: "Reply deleted successfully ✅", 
      post,
      repliesCount: comment.replies.length
    });

  } catch (error) {
    console.error("Delete Reply Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


export const likeReply = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { postId, commentId, replyId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to like a reply",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(postId) ||
      !mongoose.Types.ObjectId.isValid(commentId) ||
      !mongoose.Types.ObjectId.isValid(replyId) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    const post = await PostModel.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    const reply = comment.replies.id(replyId);
    if (!reply) {
      return res.status(404).json({
        success: false,
        message: "Reply not found",
      });
    }

    const likedIndex = reply.likes.indexOf(userId);
    let isLiked = false;

    if (likedIndex > -1) {
      reply.likes.splice(likedIndex, 1);
      isLiked = false;
    } else {
      reply.likes.push(userId);
      isLiked = true;
    }

    await post.save();

    await post.populate("userId", "fullname profilePic email username");
    await post.populate("comments.userId", "fullname profilePic username");
    await post.populate("comments.replies.userId", "fullname profilePic username");

    // ======================================================
    // 🔔 REAL-TIME LIKE REPLY NOTIFICATION
    // ======================================================
    if (isLiked && reply.userId.toString() !== userId.toString()) {
      const io = req.app.get("io");
      const liker = await UserModel.findById(userId).select("fullname profilePic username");

      // Create the notification document
      const notification = new NotificationModel({
        sender: userId,
        receiver: reply.userId,
        type: "like",
        postId,
        content: `${liker.fullname} liked your reply 💬❤️`,
      });

      await notification.save();
      await notification.populate("sender", "fullname profilePic username");

      // Emit to receiver via socket
      if (io) {
        io.to(reply.userId.toString()).emit("notification", {
          _id: notification._id,
          sender: notification.sender,
          type: notification.type,
          postId: notification.postId,
          content: notification.content,
          createdAt: notification.createdAt,
          isRead: false,
        });
      }
    }
    // ======================================================

    res.status(200).json({
      success: true,
      message: isLiked ? "Reply liked ✅" : "Reply unliked ✅",
      post,
      isLiked,
      replyLikesCount: reply.likes.length,
    });
  } catch (error) {
    console.error("Like Reply Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};