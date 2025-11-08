import express from 'express'
import upload from '../Middleware/uploadMiddleware.js'
import { 
  addComment, 
  createPost, 
  deleteComment, 
  deleteMyPost, 
  getAllPosts, 
  getMyPosts,
  getSinglePost,         // ✅ ADD THIS IMPORT
  toggleLikePost,
  likeComment,
  addReply,
  deleteReply,
  likeReply
} from '../Controllers/Post.controller.js'
import { authMiddleware } from '../Middleware/authMiddleware.js'

export const PostRouter = express.Router()

// ============ POST ROUTES ============
// Create post
PostRouter.post('/create', authMiddleware(["user"]), upload.fields([
    { name: 'image', maxCount: 5 },
    { name: 'video', maxCount: 3 },
]), createPost)

// Get all posts
PostRouter.get('/all-post', authMiddleware(["user"]), getAllPosts)

// Get single post by ID - ✅ ADD THIS ROUTE
PostRouter.get('/post/:id', authMiddleware(["user"]), getSinglePost)

// Get my posts
PostRouter.get('/my-post', authMiddleware(["user"]), getMyPosts)

// Delete post
PostRouter.delete('/delete/:id', authMiddleware(["user"]), deleteMyPost)

// Like/Dislike post
PostRouter.post("/like/:id", authMiddleware(["user"]), toggleLikePost)

// ============ COMMENT ROUTES ============
// Add comment
PostRouter.post("/comment/:id", authMiddleware(["user"]), addComment)

// Delete comment
PostRouter.delete("/comment/:postId/:commentId", authMiddleware(["user"]), deleteComment)

// Like comment
PostRouter.post("/comment/:postId/:commentId/like", authMiddleware(["user"]), likeComment)

// ============ REPLY ROUTES ============
// Add reply to comment
PostRouter.post("/reply/:postId/:commentId", authMiddleware(["user"]), addReply)

// Delete reply
PostRouter.delete("/reply/:postId/:commentId/:replyId", authMiddleware(["user"]), deleteReply)

// Like reply
PostRouter.post("/reply/:postId/:commentId/:replyId/like", authMiddleware(["user"]), likeReply)

export default PostRouter