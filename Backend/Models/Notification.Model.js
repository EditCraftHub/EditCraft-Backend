import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    type: {
        type: String,
        enum: ["like", "comment", "reply", "new_post", "new_message", "first_message"],
        required: true
    },
    // Optional fields - only populated based on type
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post"
    },
    messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "message"
    },
    chatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "chat"
    },
    content: {
        type: String,
        maxlength: 200
    },
    isRead: {
        type: Boolean,
        default: false,
        index: true
    },
    readAt: {
        type: Date
    }
}, { timestamps: true });

// Indexes for performance
notificationSchema.index({ receiver: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ sender: 1, createdAt: -1 });

// Auto-delete notifications after 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

export const NotificationModel = mongoose.model("notification", notificationSchema);