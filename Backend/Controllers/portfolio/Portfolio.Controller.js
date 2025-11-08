import { UserModel } from "../../Models/User.Model.js";
import { PortfolioModel } from "../../Models/PortfolioModel.js";
import s3 from "../../lib/s3.js";

// ✅ Update portfolio details (bio, description, social links)
export const updatePortfolio = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bio, description, socialLinks, isPublic } = req.body;

    // Get or create portfolio automatically
    let portfolio = await PortfolioModel.findOne({ owner: userId });
    if (!portfolio) {
      portfolio = new PortfolioModel({ owner: userId, owner: userId });
    }

    if (bio) portfolio.bio = bio;
    if (description) portfolio.description = description;
    if (socialLinks) portfolio.socialLinks = socialLinks;
    if (typeof isPublic !== "undefined") portfolio.isPublic = isPublic;

    await portfolio.save();
    res.status(200).json({ success: true, portfolio });
  } catch (err) {
    console.error("Update portfolio error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ✅ Add photos/videos to portfolio (limits based on account type)
export const addMedia = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch user
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Fetch or create portfolio
    let portfolio = await PortfolioModel.findOne({ owner: userId });
    if (!portfolio) {
      portfolio = new PortfolioModel({ owner: userId });
    }

    // Limits based on account type
    const photoLimit = user.accountType === "verified_premium" ? 50 : 3;
    const videoLimit = user.accountType === "verified_premium" ? 100 : 5;

    // Validate files exist
    if (!req.files?.photos && !req.files?.videos) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    // Helper function to upload files to S3
    const uploadToS3 = async (file, folder) => {
      const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `${folder}/${Date.now()}-${file.originalname}`,
        Body: file.buffer,
        ContentType: file.mimetype,
      };
      try {
        const uploaded = await s3.upload(params).promise();
        return uploaded.Location;
      } catch (awsErr) {
        console.error(`AWS upload error for ${file.originalname}:`, awsErr);
        throw new Error(`Failed to upload ${file.originalname}. Please check your AWS setup.`);
      }
    };

    // Upload photos
    if (req.files?.photos?.length > 0) {
      if (portfolio.photos.length + req.files.photos.length > photoLimit) {
        return res.status(400).json({
          success: false,
          message: `Photo limit reached for your plan (${user.accountType}). Upgrade to verified_premium to upload more.`,
        });
      }

      for (const file of req.files.photos) {
        const url = await uploadToS3(file, "portfolio/photos");
        portfolio.photos.push({
          url,
          title: req.body.title || "",
          description: req.body.description || "",
        });
      }
    }

    // Upload videos
    if (req.files?.videos?.length > 0) {
      if (portfolio.videos.length + req.files.videos.length > videoLimit) {
        return res.status(400).json({
          success: false,
          message: `Video limit reached for your plan (${user.accountType}). Upgrade to verified_premium to upload more.`,
        });
      }

      for (const file of req.files.videos) {
        const url = await uploadToS3(file, "portfolio/videos");
        portfolio.videos.push({
          url,
          title: req.body.title || "",
          description: req.body.description || "",
        });
      }
    }

    // Save portfolio
    await portfolio.save();

    res.status(200).json({
      success: true,
      message: "Media uploaded successfully ✅",
      portfolio,
    });

  } catch (err) {
    console.error("Add media error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Server error while adding media",
    });
  }
};



// ✅ Get portfolio by username (public view)
export const getPortfolioByUser = async (req, res) => {
  try {
    const { username, email, fullname } = req.query; // allow multiple filters

    // Build dynamic filter
    let userFilter = {};
    if (username) userFilter.username = username;
    if (email) userFilter.email = email;
    if (fullname) userFilter.fullname = fullname;

    const user = await UserModel.findOne(userFilter);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const portfolio = await PortfolioModel.findOne({ owner: user._id });
    if (!portfolio) return res.status(404).json({ success: false, message: "Portfolio not found" });

    // Combine user info with portfolio
    const response = {
      username: user.username,
      fullname: user.fullname,
      email: user.email,
      accountType: user.accountType,
      portfolio
    };

    res.status(200).json({ success: true, data: response });
  } catch (err) {
    console.error("Get portfolio error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};