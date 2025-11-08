import express from 'express'
import { authMiddleware } from '../Middleware/authMiddleware.js'
import { 
  getMessages, 
  getOrCreateChat, 
  getUserChats, 
  sendMessage,
  markMessageAsRead,
  markChatAsRead,
  deleteMessage,
  searchMessages,
  clearChat,
  getChatById
} from '../Controllers/Chat.controller.js'

export const ChatRouter = express.Router()

// ==================== GET CHATS ====================

// Get all user chats
ChatRouter.get('/chats', authMiddleware(["user"]), getUserChats)

// Get specific chat by ID with details
ChatRouter.get('/chat/:chatId', authMiddleware(["user"]), getChatById)

// ==================== CREATE/GET CHAT ====================

// Create or get chat between two users
ChatRouter.post('/chat', authMiddleware(["user"]), getOrCreateChat)

// ==================== MESSAGES ====================

// Get all messages for a specific chat (with pagination support)
ChatRouter.get('/:chatId/messages', authMiddleware(["user"]), getMessages)

// Send a message
ChatRouter.post('/send-message', authMiddleware(["user"]), sendMessage)

// ==================== MESSAGE MANAGEMENT ====================

// Mark single message as read
ChatRouter.post('/mark-as-read', authMiddleware(["user"]), markMessageAsRead)

// Mark all messages in chat as read
ChatRouter.post('/mark-chat-as-read/:chatId', authMiddleware(["user"]), markChatAsRead)

// Delete a message
ChatRouter.delete('/delete-message/:messageId', authMiddleware(["user"]), deleteMessage)

// Search messages in a chat
ChatRouter.get('/:chatId/search', authMiddleware(["user"]), searchMessages)

// Clear entire chat history
ChatRouter.delete('/clear-chat/:chatId', authMiddleware(["user"]), clearChat)