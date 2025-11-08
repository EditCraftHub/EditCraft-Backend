import mongoose from "mongoose";

const portfolioSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  bio: { type: String, default: "Hello, I’m new here!" },
  description: { type: String, default: "" },
  profilePic: { type: String, default: "" },
  banner: { type: String, default: "" },
  portfolioLinks: [
    {
      title: String,
      url: String,
      icon: String,
      order: Number,
      isVisible: { type: Boolean, default: true }
    }
  ],
  photos: [
    { url: String, title: String, description: String }
  ],
  videos: [
    { url: String, title: String, description: String }
  ],
  likes: { type: Number, default: 0 },
  isPublic: { type: Boolean, default: true }
}, { timestamps: true });

export const PortfolioModel = mongoose.model("portfolio", portfolioSchema);
