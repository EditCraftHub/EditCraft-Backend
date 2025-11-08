import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, "Username is required"],
        unique: true,
        trim: true,
        minlength: [4, "Username must be at least 4 characters long"],
        maxlength: [20, "Username cannot exceed 20 characters"]
    },

    fullname: {
        type: String,
        required: [true, "Full name is required"],
        trim: true
    },

    bio:{
        type: String,
        required: true,
        default: "Hello There Im New In Editcraft"
    },

    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            "Please enter a valid email address"
        ]
    },

    password: {
        type: String,
        required: [true, "Password is required"]
    },

    profilePic: {
        type: String, 
        default: "https://cdn-icons-png.flaticon.com/512/149/149071.png"
    },

    banner: {
        type: String, 
        default: "https://img.freepik.com/free-vector/gradient-abstract-background_23-2149117059.jpg"
    },

    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "user"
    }],

    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "user"
    }],

    post:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: "post"
    }],

    accountType: {
        type: String,
        enum: ["free", "verified_user", "verified_premium"],
        default: "free"
    },

    planExpiresAt: {
        type: Date,
        default: null
    },

    role: {
        type: String,
        enum: ["user", "admin", "super_admin"],
        default: "user"
    },

    // ✅ OTP Verification fields
    isVerified: {
        type: Boolean,
        default: false
    },
    otp: {
        type: String
    },
    otpExpires: {
        type: Date
    },

    // ✅ Password Reset via OTP
    resetOtp: {
        type: String
    },
    resetOtpExpires: {
        type: Date
    },

    // ✅ Ban Management
    isBanned: { 
        type: Boolean, 
        default: false 
    },
    banExpires: { 
        type: Date, 
        default: null 
    },
    banReason: { 
        type: String, 
        default: "" 
    },

    // ✅ ONLINE STATUS TRACKING
    isOnline: {
        type: Boolean,
        default: false
    },
    lastSeen: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ["online", "offline", "away", "busy"],
        default: "offline"
    }

}, { timestamps: true });

// Index for better query performance on online status
userSchema.index({ isOnline: 1, lastSeen: -1 });

export const UserModel = mongoose.model("user", userSchema);
export default UserModel