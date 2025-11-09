// socket/socketServer.js
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { UserModel } from '../Models/User.Model.js';
import { NotificationModel } from '../Models/Notification.Model.js';
import dotenv from 'dotenv';

dotenv.config();

const onlineUsers = new Map();

export const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: ["http://localhost:3000", "http://localhost:5000","https://api.editcraft.co.in"],
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.accessToken;
      if (!token) return next(new Error('No token'));

      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const user = await UserModel.findById(decoded.id);

      if (!user || !user.isVerified) return next(new Error('Invalid user'));

      socket.user = user;
      socket.userId = user._id.toString();
      next();
    } catch (error) {
      next(new Error('Auth failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ CONNECTED: ${socket.user.name} (${socket.id})`);

    // Listen for user online event
    socket.on('userOnline', (userInfo) => {
      const userId = userInfo.userId || socket.userId;
      
      onlineUsers.set(userId, {
        _id: userInfo.userId || socket.user._id,
        id: userInfo.userId || socket.user._id,
        socketId: socket.id,
        name: userInfo.name || socket.user.name,
        email: userInfo.email || socket.user.email,
        profilePic: userInfo.profilePic || socket.user.profilePic,
        role: userInfo.role || socket.user.role,
        accountType: userInfo.accountType || socket.user.accountType,
        lastSeen: new Date(),
      });

      console.log(`🟢 User Online: ${userInfo.name} (${userId})`);
      io.emit('onlineUsers', Array.from(onlineUsers.values()));
    });

    // Heartbeat
    socket.on('userHeartbeat', (data) => {
      const userId = data.userId;
      if (onlineUsers.has(userId)) {
        const userInfo = onlineUsers.get(userId);
        userInfo.lastSeen = new Date();
        onlineUsers.set(userId, userInfo);
        console.log(`💓 Heartbeat: ${userInfo.name}`);
      }
    });

    // Handle direct messages
    socket.on('sendDirectMessage', (data) => {
      const receiverId = data.receiverId;
      const senderInfo = onlineUsers.get(socket.userId);

      console.log(`📨 Message from ${senderInfo?.name} to ${receiverId}: "${data.text}"`);

      let receiverSocketId = null;
      for (let [userId, userInfo] of onlineUsers) {
        if (userId === receiverId) {
          receiverSocketId = userInfo.socketId;
          break;
        }
      }

      if (receiverSocketId) {
        io.to(receiverSocketId).emit('receiveDirectMessage', {
          senderId: socket.userId,
          senderName: senderInfo?.name,
          senderProfilePic: senderInfo?.profilePic,
          text: data.text,
          timestamp: new Date(),
        });
        console.log(`✅ Message delivered to ${receiverId}`);
      } else {
        console.log(`❌ Receiver ${receiverId} not found`);
      }
    });

    // ==================== NEW NOTIFICATION EVENTS ====================

    // 🔔 NEW POST NOTIFICATION - Broadcast to all followers
    socket.on('newPostCreated', async (data) => {
      try {
        const { postId, userId, title, image } = data;
        const user = await UserModel.findById(userId).select('followers username profilePic');

        if (!user || !user.followers || user.followers.length === 0) return;

        // Send notification to each follower
        for (const followerId of user.followers) {
          const followerIdStr = followerId.toString();
          const followerInfo = onlineUsers.get(followerIdStr);

          // Create notification in DB
          const notification = await NotificationModel.create({
            sender: userId,
            receiver: followerId,
            type: 'new_post',
            postId: postId,
            content: `${user.username} posted: ${title}`
          });

          await notification.populate('sender', 'username profilePic');

          // Send real-time notification if follower is online
          if (followerInfo && followerInfo.socketId) {
            io.to(followerInfo.socketId).emit('notification', {
              _id: notification._id,
              type: 'new_post',
              sender: notification.sender,
              content: notification.content,
              postId: postId,
              image: image,
              createdAt: notification.createdAt,
              isRead: false
            });
            console.log(`🔔 New post notification sent to ${followerInfo.name}`);
          }
        }
      } catch (error) {
        console.error('❌ Error sending new post notification:', error);
      }
    });

    // 💬 NEW MESSAGE NOTIFICATION
    socket.on('newMessage', async (data) => {
      try {
        const { messageId, chatId, senderId, receiverId, text } = data;
        const sender = await UserModel.findById(senderId).select('username profilePic');
        const receiverInfo = onlineUsers.get(receiverId);

        // Create notification in DB
        const notification = await NotificationModel.create({
          sender: senderId,
          receiver: receiverId,
          type: 'new_message',
          messageId: messageId,
          chatId: chatId,
          content: `${sender.username} sent you a message: ${text.substring(0, 50)}...`
        });

        await notification.populate('sender', 'username profilePic');

        // Send real-time notification if receiver is online
        if (receiverInfo && receiverInfo.socketId) {
          io.to(receiverInfo.socketId).emit('notification', {
            _id: notification._id,
            type: 'new_message',
            sender: notification.sender,
            content: notification.content,
            chatId: chatId,
            messageId: messageId,
            createdAt: notification.createdAt,
            isRead: false
          });
          console.log(`🔔 Message notification sent to ${receiverInfo.name}`);
        }
      } catch (error) {
        console.error('❌ Error sending message notification:', error);
      }
    });

    // 💬 FIRST MESSAGE NOTIFICATION (for new chats)
    socket.on('firstMessage', async (data) => {
      try {
        const { messageId, chatId, senderId, receiverId, text } = data;
        const sender = await UserModel.findById(senderId).select('username profilePic');
        const receiverInfo = onlineUsers.get(receiverId);

        const notification = await NotificationModel.create({
          sender: senderId,
          receiver: receiverId,
          type: 'first_message',
          messageId: messageId,
          chatId: chatId,
          content: `${sender.username} started a conversation with you`
        });

        await notification.populate('sender', 'username profilePic');

        if (receiverInfo && receiverInfo.socketId) {
          io.to(receiverInfo.socketId).emit('notification', {
            _id: notification._id,
            type: 'first_message',
            sender: notification.sender,
            content: notification.content,
            chatId: chatId,
            messageId: messageId,
            createdAt: notification.createdAt,
            isRead: false
          });
          console.log(`🔔 First message notification sent to ${receiverInfo.name}`);
        }
      } catch (error) {
        console.error('❌ Error sending first message notification:', error);
      }
    });

    // ❤️ POST LIKE NOTIFICATION
    socket.on('postLiked', async (data) => {
      try {
        const { postId, likerId, postOwnerId, postTitle } = data;
        
        // Don't notify if user likes their own post
        if (likerId === postOwnerId) return;

        const liker = await UserModel.findById(likerId).select('username profilePic');
        const ownerInfo = onlineUsers.get(postOwnerId);

        const notification = await NotificationModel.create({
          sender: likerId,
          receiver: postOwnerId,
          type: 'like',
          postId: postId,
          content: `${liker.username} liked your post: ${postTitle}`
        });

        await notification.populate('sender', 'username profilePic');

        if (ownerInfo && ownerInfo.socketId) {
          io.to(ownerInfo.socketId).emit('notification', {
            _id: notification._id,
            type: 'like',
            sender: notification.sender,
            content: notification.content,
            postId: postId,
            createdAt: notification.createdAt,
            isRead: false
          });
          console.log(`🔔 Like notification sent to post owner`);
        }
      } catch (error) {
        console.error('❌ Error sending like notification:', error);
      }
    });

    // 💭 COMMENT NOTIFICATION
    socket.on('postCommented', async (data) => {
      try {
        const { postId, commenterId, postOwnerId, postTitle, commentText } = data;
        
        // Don't notify if user comments on their own post
        if (commenterId === postOwnerId) return;

        const commenter = await UserModel.findById(commenterId).select('username profilePic');
        const ownerInfo = onlineUsers.get(postOwnerId);

        const notification = await NotificationModel.create({
          sender: commenterId,
          receiver: postOwnerId,
          type: 'comment',
          postId: postId,
          content: `${commenter.username} commented on your post: ${commentText.substring(0, 50)}...`
        });

        await notification.populate('sender', 'username profilePic');

        if (ownerInfo && ownerInfo.socketId) {
          io.to(ownerInfo.socketId).emit('notification', {
            _id: notification._id,
            type: 'comment',
            sender: notification.sender,
            content: notification.content,
            postId: postId,
            createdAt: notification.createdAt,
            isRead: false
          });
          console.log(`🔔 Comment notification sent to post owner`);
        }
      } catch (error) {
        console.error('❌ Error sending comment notification:', error);
      }
    });

    // 💬 REPLY NOTIFICATION
    socket.on('commentReplied', async (data) => {
      try {
        const { postId, replierId, commentOwnerId, replyText } = data;
        
        // Don't notify if user replies to their own comment
        if (replierId === commentOwnerId) return;

        const replier = await UserModel.findById(replierId).select('username profilePic');
        const ownerInfo = onlineUsers.get(commentOwnerId);

        const notification = await NotificationModel.create({
          sender: replierId,
          receiver: commentOwnerId,
          type: 'reply',
          postId: postId,
          content: `${replier.username} replied to your comment: ${replyText.substring(0, 50)}...`
        });

        await notification.populate('sender', 'username profilePic');

        if (ownerInfo && ownerInfo.socketId) {
          io.to(ownerInfo.socketId).emit('notification', {
            _id: notification._id,
            type: 'reply',
            sender: notification.sender,
            content: notification.content,
            postId: postId,
            createdAt: notification.createdAt,
            isRead: false
          });
          console.log(`🔔 Reply notification sent to comment owner`);
        }
      } catch (error) {
        console.error('❌ Error sending reply notification:', error);
      }
    });

    // ==================== TYPING INDICATORS ====================

// 🔤 USER IS TYPING
socket.on('userTyping', (data) => {
    const { receiverId, senderName } = data;
    const receiverInfo = onlineUsers.get(receiverId);
    
    if (receiverInfo?.socketId) {
        io.to(receiverInfo.socketId).emit('userTyping', {
            senderId: socket.userId,
            senderName: senderName,
            timestamp: new Date()
        });
    }
});

// 🛑 USER STOPPED TYPING
socket.on('userStoppedTyping', (data) => {
    const { receiverId } = data;
    const receiverInfo = onlineUsers.get(receiverId);
    
    if (receiverInfo?.socketId) {
        io.to(receiverInfo.socketId).emit('userStoppedTyping', {
            senderId: socket.userId
        });
    }
});

    // 📖 MARK NOTIFICATION AS READ
    socket.on('markNotificationRead', async (data) => {
      try {
        const { notificationId } = data;
        await NotificationModel.findByIdAndUpdate(notificationId, {
          isRead: true,
          readAt: new Date()
        });
        console.log(`✅ Notification ${notificationId} marked as read`);
      } catch (error) {
        console.error('❌ Error marking notification as read:', error);
      }
    });

    // 📖 MARK ALL NOTIFICATIONS AS READ
    socket.on('markAllNotificationsRead', async (data) => {
      try {
        const { userId } = data;
        await NotificationModel.updateMany(
          { receiver: userId, isRead: false },
          { isRead: true, readAt: new Date() }
        );
        console.log(`✅ All notifications marked as read for user ${userId}`);
      } catch (error) {
        console.error('❌ Error marking all notifications as read:', error);
      }
    });

    // ==================== EXISTING EVENTS ====================

    socket.on('userOffline', (data) => {
      const userId = data.userId;
      onlineUsers.delete(userId);
      console.log(`⚫ User Offline: ${userId}`);
      io.emit('onlineUsers', Array.from(onlineUsers.values()));
    });

    socket.on('disconnect', () => {
      onlineUsers.delete(socket.userId);
      console.log(`❌ DISCONNECTED: ${socket.user.name} (${socket.id})`);
      io.emit('onlineUsers', Array.from(onlineUsers.values()));
    });
  });

  // Export io instance for use in controllers
  return io;
};

// Helper function to emit notifications from anywhere in your app
export const emitNotification = (io, userId, notification) => {
  const userInfo = onlineUsers.get(userId);
  if (userInfo && userInfo.socketId) {
    io.to(userInfo.socketId).emit('notification', notification);
  }
};