// Models/Post.Model.js
import mongoose from 'mongoose';

const replySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
      required: true
    },
    text: {
      type: String,
      required: true,
      maxlength: 500
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
      }
    ],
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const commentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
      required: true
    },
    text: {
      type: String,
      required: true,
      maxlength: 500
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
      }
    ],
    replies: [replySchema], // ✅ Add replies array
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      maxlength: 200
    },
    description: {
      type: String,
      required: true,
      maxlength: 2000
    },
    jobDuration: String,
    jobType: {
      type: String,
      enum: ['freelance', 'part-time', 'full-time', 'contract'],
      default: 'freelance'
    },
    price: {
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      currency: {
        type: String,
        enum: ['INR', 'USD', 'EUR', 'GBP'],
        default: 'INR'
      }
    },
    image: [String],
    video: [String],
    tags: [String],
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
      required: true
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
      }
    ],
    comments: [commentSchema],
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

export const PostModel = mongoose.model('Post', postSchema);