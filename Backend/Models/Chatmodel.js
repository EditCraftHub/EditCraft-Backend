import mongoose from "mongoose";

// Chat Schema
const chatSchema = new mongoose.Schema({
  participants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true
    }
  ],
  isGroupChat: {
    type: Boolean,
    default: false
  },
  groupName: {
    type: String,
    required: function() {
      return this.isGroupChat;
    }
  },
  groupAvatar: String,
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "message"
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Message Schema
const messageSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "chat",  // ✅ lowercase
      required: true,
      index: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",  // ✅ lowercase
      required: true,
      index: true
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      minlength: [1, "Message cannot be empty"],
      maxlength: [5000, "Message cannot exceed 5000 characters"]
    },
    read: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: {
      type: Date,
      default: null
    },
    deletedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user"  // ✅ lowercase
      }
    ],
    sentAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
);

// ✅ INDEXES
messageSchema.index({ chatId: 1, sentAt: -1 });
messageSchema.index({ sender: 1, sentAt: -1 });

export const MessageModel = mongoose.model("message", messageSchema);
export const ChatModel = mongoose.model("chat", chatSchema);
