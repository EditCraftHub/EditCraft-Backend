import { UserModel } from "../Models/User.Model.js";
import { ChatModel, MessageModel } from "../Models/Chatmodel.js";
import { NotificationModel } from "../Models/Notification.Model.js";
import mongoose from "mongoose";

// Store io instance globally to use in controllers
let io;

export const setSocketIO = (socketIO) => {
  io = socketIO;
};

/**
 * Create or fetch a chat between two users
 */
export const getOrCreateChat = async (req, res) => {
  try {
    const senderId = req.user?.id;
    const { userId } = req.body;

    if (!senderId) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!userId) return res.status(400).json({ success: false, message: "User ID is required" });

    // Check if recipient exists
    const recipient = await UserModel.findById(userId);
    if (!recipient) return res.status(404).json({ success: false, message: "Recipient not found" });

    // Find existing chat
    let chat = await ChatModel.findOne({
      participants: { $all: [senderId, userId] },
      isGroupChat: false
    }).populate("participants", "username email avatar accountType");

    // Create chat if not exists
    if (!chat) {
      chat = await ChatModel.create({
        participants: [senderId, userId],
        isGroupChat: false
      });
      chat = await chat.populate("participants", "username email avatar accountType");
      console.log(`💬 New chat created between ${senderId} and ${userId}`);
    }

    return res.status(200).json({ success: true, chat });
  } catch (err) {
    console.error("❌ getOrCreateChat error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * Send message with NOTIFICATION - ⚡ FIRST MESSAGE DETECTION
 */
export const sendMessage = async (req, res) => {
  try {
    const senderId = req.user?.id;
    const { recipientId, message } = req.body;

    if (!senderId) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!recipientId || !message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Recipient ID and message are required" });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(recipientId)) {
      return res.status(400).json({ success: false, message: "Invalid user IDs" });
    }

    const sender = await UserModel.findById(senderId);
    if (!sender) return res.status(404).json({ success: false, message: "Sender not found" });

    const recipient = await UserModel.findById(recipientId);
    if (!recipient) return res.status(404).json({ success: false, message: "Recipient not found" });

    // Find existing chat or create new one
    let chat = await ChatModel.findOne({
      participants: { $all: [sender._id, recipient._id] },
      isGroupChat: false
    });

    // ⚡ CHECK IF FIRST MESSAGE
    const messageCount = await MessageModel.countDocuments({
      chatId: chat?._id || new mongoose.Types.ObjectId()
    });

    const isFirstMessage = messageCount === 0;

    if (!chat) {
      chat = await ChatModel.create({
        participants: [sender._id, recipient._id],
        isGroupChat: false
      });
      console.log(`💬 New chat created between ${sender.username} and ${recipient.username}`);
    }

    // Create message
    const newMessage = await MessageModel.create({
      chatId: chat._id,
      sender: sender._id,
      message: message.trim(),
      sentAt: new Date()
    });

    // Populate sender info for response
    await newMessage.populate("sender", "username fullname email avatar profilePic accountType role");

    // Update chat's lastMessage and lastMessageAt
    chat.lastMessage = newMessage._id;
    chat.lastMessageAt = new Date();
    await chat.save();

    // 🔔 CREATE NOTIFICATION
    let notificationType = "new_message";
    let notificationContent = `${sender.username} sent you a message: ${message.substring(0, 50)}...`;

    if (isFirstMessage) {
      notificationType = "first_message";
      notificationContent = `${sender.username} started a conversation with you`;
    }

    const notification = await NotificationModel.create({
      sender: sender._id,
      receiver: recipient._id,
      type: notificationType,
      messageId: newMessage._id,
      chatId: chat._id,
      content: notificationContent
    });

    await notification.populate("sender", "username profilePic email");

    // Prepare message data for socket
    const messageData = {
      _id: newMessage._id,
      chatId: chat._id.toString(),
      sender: {
        _id: sender._id,
        username: sender.username,
        fullname: sender.fullname,
        avatar: sender.avatar,
        profilePic: sender.profilePic,
        accountType: sender.accountType,
        role: sender.role
      },
      message: newMessage.message,
      sentAt: newMessage.sentAt,
      read: false
    };

    // ⚡ EMIT SOCKET EVENTS
    if (io) {
      const socketData = {
        messageId: newMessage._id,
        chatId: chat._id,
        senderId: sender._id,
        receiverId: recipient._id,
        text: message
      };

      if (isFirstMessage) {
        console.log(`🔔 FIRST MESSAGE - Emitting notification`);
        io.emit("firstMessage", socketData);
      } else {
        console.log(`💬 NEW MESSAGE - Emitting notification`);
        io.emit("newMessage", socketData);
      }

      // Also emit message for real-time chat
      io.emit('receiveMessage', messageData);
      
      console.log(`📤 Message & Notification broadcasted:`, {
        from: sender.username,
        to: recipient.username,
        type: notificationType,
        messageId: newMessage._id
      });
    }

    return res.status(200).json({
      success: true,
      message: "Message sent successfully",
      data: {
        _id: newMessage._id,
        chatId: chat._id,
        sender: {
          _id: newMessage.sender._id,
          username: newMessage.sender.username,
          fullname: newMessage.sender.fullname,
          email: newMessage.sender.email,
          avatar: newMessage.sender.avatar,
          profilePic: newMessage.sender.profilePic,
          accountType: newMessage.sender.accountType,
          role: newMessage.sender.role
        },
        message: newMessage.message,
        sentAt: newMessage.sentAt,
        read: false,
        isFirstMessage: isFirstMessage
      },
    });
  } catch (err) {
    console.error("❌ sendMessage error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * Fetch messages in a chat
 */
export const getMessages = async (req, res) => {
  try {
    const senderId = req.user?.id;
    if (!senderId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const chatId = req.query.chatId || req.params.chatId;
    const recipientId = req.query.recipientId || req.params.recipientId;

    let chat;
    let messages;

    if (chatId) {
      if (!mongoose.Types.ObjectId.isValid(chatId))
        return res.status(400).json({ success: false, message: "Invalid chat ID" });

      chat = await ChatModel.findById(chatId)
        .populate("participants", "username fullname email avatar profilePic accountType role");

      if (!chat) return res.status(404).json({ success: false, message: "Chat not found" });

      messages = await MessageModel.find({ chatId })
        .populate("sender", "username fullname email avatar profilePic accountType role")
        .sort({ sentAt: 1 });

    } else if (recipientId) {
      if (!mongoose.Types.ObjectId.isValid(recipientId))
        return res.status(400).json({ success: false, message: "Invalid recipient ID" });

      chat = await ChatModel.findOne({
        participants: { $all: [senderId, recipientId] },
        isGroupChat: false
      }).populate("participants", "username fullname email avatar profilePic accountType role");

      if (!chat) {
        chat = await ChatModel.create({
          participants: [senderId, recipientId],
          isGroupChat: false
        });
        chat = await chat.populate("participants", "username fullname email avatar profilePic accountType role");
        console.log(`💬 New chat created between ${senderId} and ${recipientId}`);
        messages = [];
      } else {
        messages = await MessageModel.find({ chatId: chat._id })
          .populate("sender", "username fullname email avatar profilePic accountType role")
          .sort({ sentAt: 1 });
      }

    } else {
      return res.status(400).json({ success: false, message: "Provide chatId or recipientId" });
    }

    return res.status(200).json({
      success: true,
      chatId: chat._id,
      participants: chat.participants,
      messages
    });

  } catch (err) {
    console.error("❌ getMessages error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * Get all chats for logged-in user
 */
export const getUserChats = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const chats = await ChatModel.find({ participants: userId })
      .populate("participants", "username fullname email avatar profilePic accountType role")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "username fullname avatar profilePic" }
      })
      .sort({ lastMessageAt: -1 });

    const formattedChats = chats.map(chat => {
      const allParticipants = chat.participants;
      
      return {
        _id: chat._id,
        chatId: chat._id,
        participants: allParticipants,
        lastMessage: chat.lastMessage?.message || null,
        lastMessageSender: chat.lastMessage?.sender || null,
        lastMessageTime: chat.lastMessageAt || null,
      };
    });

    return res.status(200).json({ success: true, chats: formattedChats });
  } catch (err) {
    console.error("❌ getUserChats error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * Get specific chat by ID
 */
export const getChatById = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.id;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ success: false, message: "Invalid chat ID" });
    }

    // Verify user is participant
    const chat = await ChatModel.findOne({
      _id: chatId,
      participants: userId
    }).populate("participants", "username email avatar accountType");

    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found or unauthorized" });
    }

    return res.status(200).json({ success: true, chat });
  } catch (err) {
    console.error("❌ getChatById error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * Mark message as read - WITH NOTIFICATION
 */
export const markMessageAsRead = async (req, res) => {
  try {
    const { messageId, chatId } = req.body;
    const userId = req.user?.id;

    if (!messageId || !chatId) {
      return res.status(400).json({ success: false, message: "Message ID and Chat ID required" });
    }

    // Verify user is in chat
    const chat = await ChatModel.findOne({
      _id: chatId,
      participants: userId
    });

    if (!chat) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const message = await MessageModel.findByIdAndUpdate(
      messageId,
      { read: true, readAt: new Date() },
      { new: true }
    ).populate("sender", "username avatar");

    // ✅ EMIT SOCKET EVENT
    if (io) {
      io.emit('messageRead', {
        messageId: message._id,
        chatId: chatId,
        readBy: userId,
        readAt: message.readAt
      });
      console.log(`✅ Message marked as read`);
    }

    return res.status(200).json({ success: true, message });
  } catch (err) {
    console.error("❌ markMessageAsRead error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * Mark all messages in chat as read
 */
export const markChatAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.id;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ success: false, message: "Invalid chat ID" });
    }

    // Verify user is in chat
    const chat = await ChatModel.findOne({
      _id: chatId,
      participants: userId
    });

    if (!chat) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    // Mark all unread messages as read
    await MessageModel.updateMany(
      { chatId, read: false },
      { read: true, readAt: new Date() }
    );

    // ✅ EMIT SOCKET EVENT
    if (io) {
      io.emit('chatRead', {
        chatId: chatId,
        readBy: userId
      });
      console.log(`✅ Chat marked as read`);
    }

    return res.status(200).json({ success: true, message: "All messages marked as read" });
  } catch (err) {
    console.error("❌ markChatAsRead error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * Delete a message - WITH NOTIFICATION
 */
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { chatId } = req.body;
    const userId = req.user?.id;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ success: false, message: "Invalid message ID" });
    }

    // Find message
    const message = await MessageModel.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    // Only sender can delete their message
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    await MessageModel.findByIdAndDelete(messageId);

    // ✅ EMIT SOCKET EVENT
    if (io) {
      io.emit('messageDeleted', {
        messageId: messageId,
        chatId: chatId || message.chatId
      });
      console.log(`🗑️ Message deleted`);
    }

    return res.status(200).json({ success: true, message: "Message deleted successfully" });
  } catch (err) {
    console.error("❌ deleteMessage error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * Search messages in a chat
 */
export const searchMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { query } = req.query;
    const userId = req.user?.id;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ success: false, message: "Invalid chat ID" });
    }

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Search query required" });
    }

    // Verify user is in chat
    const chat = await ChatModel.findOne({
      _id: chatId,
      participants: userId
    });

    if (!chat) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    // Search messages
    const messages = await MessageModel.find({
      chatId,
      message: { $regex: query, $options: "i" }
    })
      .populate("sender", "username avatar")
      .sort({ sentAt: -1 });

    return res.status(200).json({ success: true, messages, count: messages.length });
  } catch (err) {
    console.error("❌ searchMessages error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * Clear chat history - WITH NOTIFICATION
 */
export const clearChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.id;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ success: false, message: "Invalid chat ID" });
    }

    // Verify user is in chat
    const chat = await ChatModel.findOne({
      _id: chatId,
      participants: userId
    });

    if (!chat) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    // Delete all messages
    const result = await MessageModel.deleteMany({ chatId });

    // Clear lastMessage from chat
    await ChatModel.findByIdAndUpdate(chatId, {
      lastMessage: null,
      lastMessageAt: null
    });

    // ✅ EMIT SOCKET EVENT
    if (io) {
      io.emit('chatCleared', {
        chatId: chatId,
        clearedBy: userId
      });
      console.log(`🧹 Chat cleared`);
    }

    return res.status(200).json({ 
      success: true, 
      message: `${result.deletedCount} messages deleted` 
    });
  } catch (err) {
    console.error("❌ clearChat error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};