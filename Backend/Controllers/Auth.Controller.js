import { UserModel } from "../Models/User.Model.js";
import { createAccessToken, createRefreshToken } from "../Tokens/Tokens.js";
import { sendOtpEmail, generateOTP } from "../lib/email.js";
import dotenv from 'dotenv';
import bcrypt from "bcryptjs";

dotenv.config();

// ✅ In-memory storage (Replace with Redis in production)
const pendingUsers = new Map();
const resetAttempts = new Map();
const loginAttempts = new Map();
const signupAttempts = new Map(); // ✅ FIXED: Added separate map for signup attempts
const resendAttempts = new Map(); // ✅ FIXED: Added missing resendAttempts map

// ✅ Cookie configuration
const cookieConfig = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax", // ✅ FIXED: Better security
  path: "/"
};

// ✅ Rate limiting helper
const checkRateLimit = (map, key, maxAttempts, windowMs) => {
  const now = Date.now();
  const attempts = map.get(key) || [];
  const recentAttempts = attempts.filter(time => now - time < windowMs);
  
  if (recentAttempts.length >= maxAttempts) {
    return { limited: true, attempts: recentAttempts.length };
  }
  
  recentAttempts.push(now);
  map.set(key, recentAttempts);
  return { limited: false, attempts: recentAttempts.length };
};

// ✅ Cleanup expired data periodically
setInterval(() => {
  const now = Date.now();
  
  // Clean expired pending users
  for (const [email, data] of pendingUsers.entries()) {
    if (data.otpExpires < now) {
      pendingUsers.delete(email);
      console.log(`🗑️ Cleaned up expired pending user: ${email}`);
    }
  }
  
  // Clean old rate limit entries
  const cleanupMap = (map, windowMs) => {
    for (const [key, attempts] of map.entries()) {
      const recentAttempts = attempts.filter(time => now - time < windowMs);
      if (recentAttempts.length === 0) {
        map.delete(key);
      } else {
        map.set(key, recentAttempts);
      }
    }
  };

  // ⏱ Keep entries for only 5 seconds
  cleanupMap(resetAttempts, 5 * 1000);
  cleanupMap(loginAttempts, 5 * 1000);
  cleanupMap(signupAttempts, 5 * 1000);
  cleanupMap(resendAttempts, 5 * 1000);

  console.log('🗑️ Rate limit cleanup executed');
}, 5 * 1000); // ✅ Run every 5 seconds










// ===================== SIGNUP =====================
export const signup = async (req, res) => {
  try {
    const { username, fullname, email, password } = req.body;

    // ✅ FIXED: Use signupAttempts instead of loginAttempts
    const clientIp = req.ip || req.connection.remoteAddress;
    const rateCheck = checkRateLimit(signupAttempts, `signup:${clientIp}`, 5, 15 * 60 * 1000);
    
    if (rateCheck.limited) {
      return res.status(429).json({ 
        success: false,
        message: "Too many signup attempts. Please try again in 15 minutes." 
      });
    }

    // Validate all required fields
    if (!username || !fullname || !email || !password) {
      return res.status(400).json({ 
        success: false,
        message: "All fields are required" 
      });
    }

    // ✅ Sanitize inputs
    const sanitizedEmail = email.toLowerCase().trim();
    const sanitizedUsername = username.trim();
    const sanitizedFullname = fullname.trim(); // ✅ FIXED: Added fullname sanitization

    // ✅ Enhanced email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedEmail)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid email format" 
      });
    }

    // ✅ Username validation
    if (sanitizedUsername.length < 3 || sanitizedUsername.length > 20) {
      return res.status(400).json({ 
        success: false,
        message: "Username must be between 3 and 20 characters" 
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(sanitizedUsername)) {
      return res.status(400).json({ 
        success: false,
        message: "Username can only contain letters, numbers, and underscores" 
      });
    }

    // ✅ FIXED: Added fullname validation
    if (sanitizedFullname.length < 2) {
      return res.status(400).json({ 
        success: false,
        message: "Full name must be at least 2 characters long" 
      });
    }

    // ✅ Password validation
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: "Password must be at least 6 characters long" 
      });
    }
    if (password.length > 20) {
      return res.status(400).json({ 
        success: false, 
        message: "Password cannot exceed 20 characters" 
      });
    }

    // Check if email already exists
    const existingEmail = await UserModel.findOne({ email: sanitizedEmail });
    if (existingEmail) {
      return res.status(409).json({ 
        success: false,
        message: "Email already exists" 
      });
    }

    // Check if username already exists
    const existingUsername = await UserModel.findOne({ username: sanitizedUsername });
    if (existingUsername) {
      return res.status(409).json({ 
        success: false,
        message: "Username already exists. Choose a different one." 
      });
    }

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate OTP
    const otp = generateOTP();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Send OTP email
    try {
      await sendOtpEmail(sanitizedEmail, otp);
      console.log(`✅ OTP sent successfully to ${sanitizedEmail}`);
    } catch (error) {
      console.error("Failed to send OTP:", error);
      return res.status(500).json({ 
        success: false,
        message: "Failed to send OTP email. Please check your email address." 
      });
    }

    // ✅ Store user data temporarily
    pendingUsers.set(sanitizedEmail, {
      username: sanitizedUsername,
      fullname: sanitizedFullname, // ✅ FIXED: Use sanitized fullname
      email: sanitizedEmail,
      password: hashedPassword,
      otp: hashedOtp,
      otpExpires,
      otpAttempts: 0,
      createdAt: Date.now()
    });

    return res.status(200).json({
      success: true,
      message: "OTP sent! Please verify your email to complete registration.",
      email: sanitizedEmail
    });

  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "An unexpected error occurred. Please try again." 
    });
  }
};

// ===================== VERIFY OTP =====================
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ 
        success: false,
        message: "Email and OTP are required" 
      });
    }

    const sanitizedEmail = email.toLowerCase().trim();
    const sanitizedOtp = otp.toString().trim(); // ✅ FIXED: Ensure OTP is string and trimmed

    // ✅ Check if user data exists in temporary storage
    const pendingUser = pendingUsers.get(sanitizedEmail);

    if (!pendingUser) {
      return res.status(404).json({ 
        success: false,
        message: "No pending registration found. Please sign up again." 
      });
    }

    // ✅ Check if OTP is expired
    if (pendingUser.otpExpires < new Date()) {
      pendingUsers.delete(sanitizedEmail);
      return res.status(400).json({ 
        success: false,
        message: "OTP expired. Please sign up again." 
      });
    }

    // ✅ Rate limiting: Max 5 OTP attempts
    if (pendingUser.otpAttempts >= 5) {
      pendingUsers.delete(sanitizedEmail);
      return res.status(429).json({ 
        success: false,
        message: "Too many failed attempts. Please sign up again." 
      });
    }

    // Compare provided OTP with hashed OTP
    const isValidOtp = await bcrypt.compare(sanitizedOtp, pendingUser.otp);
    
    if (!isValidOtp) {
      pendingUser.otpAttempts++;
      pendingUsers.set(sanitizedEmail, pendingUser);
      
      return res.status(400).json({ 
        success: false,
        message: `Invalid OTP. ${5 - pendingUser.otpAttempts} attempts remaining.` 
      });
    }

    // ✅ OTP is valid - Save user to database
    const newUser = new UserModel({
      username: pendingUser.username,
      fullname: pendingUser.fullname,
      email: pendingUser.email,
      password: pendingUser.password,
      isVerified: true
    });

    await newUser.save();

    // Remove from pending users
    pendingUsers.delete(sanitizedEmail);

    // Generate tokens
    const accessToken = createAccessToken({ id: newUser._id, role: newUser.role });
    const refreshToken = createRefreshToken({ id: newUser._id, role: newUser.role });

    // ✅ Set cookies with consistent config
    res.cookie("refreshToken", refreshToken, {
      ...cookieConfig,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.cookie("accessToken", accessToken, {
      ...cookieConfig,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 15 minutes
    });

    return res.status(201).json({ 
      success: true, 
      message: "User verified and registered successfully",
      accessToken,
      refreshToken,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        fullname: newUser.fullname,
        role: newUser.role
      }
    });

  } catch (error) {
    console.error("OTP verification error:", error);

    if (error.code === 11000) {
      // ✅ FIXED: Clear pending user on duplicate error
      const sanitizedEmail = req.body.email?.toLowerCase().trim();
      if (sanitizedEmail) {
        pendingUsers.delete(sanitizedEmail);
      }
      return res.status(409).json({ 
        success: false, 
        message: "User already exists" 
      });
    }

    return res.status(500).json({ 
      success: false, 
      message: "Server error. Please try again." 
    });
  }
};

// ===================== RESEND OTP (SIGNUP) =====================
export const resendSignupOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: "Email is required" 
      });
    }

    const sanitizedEmail = email.toLowerCase().trim();

    // ✅ Check if pending user exists
    const pendingUser = pendingUsers.get(sanitizedEmail);

    if (!pendingUser) {
      return res.status(404).json({ 
        success: false,
        message: "No pending registration found. Please sign up first." 
      });
    }

    // ✅ Rate limiting: Max 3 resend attempts per 15 minutes
    const now = Date.now();
    const attempts = resendAttempts.get(sanitizedEmail) || [];
    const recentAttempts = attempts.filter(time => now - time < 15 * 60 * 1000);
    
    if (recentAttempts.length >= 3) {
      const oldestAttempt = Math.min(...recentAttempts);
      const timeLeft = Math.ceil((15 * 60 * 1000 - (now - oldestAttempt)) / 60000);
      
      return res.status(429).json({ 
        success: false,
        message: `Too many resend attempts. Try again in ${timeLeft} minutes.` 
      });
    }

    // ✅ Check cooldown: 60 seconds between resends
    if (recentAttempts.length > 0) {
      const lastAttempt = Math.max(...recentAttempts);
      const timeSinceLastAttempt = now - lastAttempt;
      
      if (timeSinceLastAttempt < 60 * 1000) {
        const waitTime = Math.ceil((60 * 1000 - timeSinceLastAttempt) / 1000);
        return res.status(429).json({ 
          success: false,
          message: `Please wait ${waitTime} seconds before requesting another OTP.` 
        });
      }
    }

    // Generate new OTP
    const otp = generateOTP();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Send OTP email
    try {
      await sendOtpEmail(sanitizedEmail, otp);
      console.log(`✅ OTP resent successfully to ${sanitizedEmail}`);
    } catch (error) {
      console.error("Failed to resend OTP:", error);
      return res.status(500).json({ 
        success: false,
        message: "Failed to send OTP email. Please try again." 
      });
    }

    // Update pending user with new OTP
    pendingUser.otp = hashedOtp;
    pendingUser.otpExpires = otpExpires;
    pendingUser.otpAttempts = 0; // Reset attempts on resend
    pendingUsers.set(sanitizedEmail, pendingUser);

    // Record resend attempt
    recentAttempts.push(now);
    resendAttempts.set(sanitizedEmail, recentAttempts);

    return res.status(200).json({
      success: true,
      message: "New OTP sent! Please check your email. Valid for 10 minutes."
    });

  } catch (error) {
    console.error("Resend OTP error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "An unexpected error occurred. Please try again." 
    });
  }
};

// ===================== LOGIN =====================
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const sanitizedEmail = email.toLowerCase().trim();

    // ✅ Rate limiting: 5 attempts per 15 minutes per email
    const rateCheck = checkRateLimit(loginAttempts, sanitizedEmail, 5, 15 * 60 * 1000);
    
    if (rateCheck.limited) {
      return res.status(429).json({
        success: false,
        message: "Too many login attempts. Please try again in 15 minutes."
      });
    }

    // Find user
    const user = await UserModel.findOne({ email: sanitizedEmail });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email first"
      });
    }

    // ✅ Check if user is banned
    if (user.isBanned) {
      if (user.banExpires && user.banExpires > new Date()) {
        return res.status(403).json({
          success: false,
          message: `You are banned until ${user.banExpires.toLocaleString()}`,
          reason: user.banReason
        });
      } else if (!user.banExpires) {
        return res.status(403).json({
          success: false,
          message: "You are permanently banned. Please contact support.",
          reason: user.banReason
        });
      } else {
        // Ban expired - auto unban
        user.isBanned = false;
        user.banExpires = null;
        user.banReason = "";
        await user.save();
      }
    }

    // Verify password
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // ✅ Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const accessToken = createAccessToken({ id: user._id, role: user.role });
    const refreshToken = createRefreshToken({ id: user._id, role: user.role });

    // ✅ Set cookies
    res.cookie("refreshToken", refreshToken, {
      ...cookieConfig,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.cookie("accessToken", accessToken, {
      ...cookieConfig,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // ✅ Clear rate limit on successful login
    loginAttempts.delete(sanitizedEmail);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken,
      refreshToken,
      user: { 
        id: user._id, 
        username: user.username, 
        email: user.email,
        fullname: user.fullname,
        role: user.role
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Server error. Please try again." 
    });
  }
};

// ===================== FORGOT PASSWORD =====================
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: "Email is required" 
      });
    }

    const sanitizedEmail = email.toLowerCase().trim();

    // ✅ Rate limiting: Max 3 attempts per 15 minutes
    const rateCheck = checkRateLimit(resetAttempts, sanitizedEmail, 3, 15 * 60 * 1000);
    
    if (rateCheck.limited) {
      return res.status(429).json({ 
        success: false,
        message: "Too many password reset attempts. Please try again in 15 minutes." 
      });
    }

    // Find user
    const user = await UserModel.findOne({ email: sanitizedEmail });
    
    // ⚠️ Security: Don't reveal if email exists
    if (!user) {
      return res.status(200).json({ 
        success: true,
        message: "If an account exists with this email, you will receive a password reset OTP." 
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({ 
        success: false,
        message: "Please verify your email first"
      });
    }

    // Generate OTP
    const resetOtp = generateOTP();
    const hashedResetOtp = await bcrypt.hash(resetOtp, 10);
    const resetOtpExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Send OTP
    try {
      await sendOtpEmail(user.email, resetOtp);
      console.log(`✅ Password reset OTP sent to ${user.email}`);
    } catch (error) {
      console.error("Failed to send password reset OTP:", error);
      return res.status(500).json({ 
        success: false,
        message: "Failed to send OTP email. Please try again." 
      });
    }

    // Save OTP
    user.resetOtp = hashedResetOtp;
    user.resetOtpExpires = resetOtpExpires;
    user.resetOtpAttempts = 0;
    await user.save();

    return res.status(200).json({ 
      success: true, 
      message: "Password reset OTP sent to your email. Valid for 10 minutes." 
    });

  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "An error occurred. Please try again."
    });
  }
};

// ===================== RESET PASSWORD =====================
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Validate input
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ 
        success: false,
        message: "Email, OTP, and new password are required" 
      });
    }

    const sanitizedEmail = email.toLowerCase().trim();
    const sanitizedOtp = otp.toString().trim(); // ✅ FIXED: Ensure OTP is string

    // ✅ Validate new password
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: "Password must be at least 6 characters long" 
      });
    }
    if (newPassword.length > 20) {
      return res.status(400).json({ 
        success: false,
        message: "Password cannot exceed 20 characters" 
      });
    }

    // Find user
    const user = await UserModel.findOne({ email: sanitizedEmail });
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "Invalid email or OTP"
      });
    }

    // Check if OTP exists
    if (!user.resetOtp || !user.resetOtpExpires) {
      return res.status(400).json({ 
        success: false,
        message: "No password reset request found. Please request a new OTP." 
      });
    }

    // ✅ Check if OTP expired
    if (new Date() > user.resetOtpExpires) {
      user.resetOtp = undefined;
      user.resetOtpExpires = undefined;
      user.resetOtpAttempts = undefined;
      await user.save();

      return res.status(400).json({ 
        success: false,
        message: "OTP has expired. Please request a new one." 
      });
    }

    // ✅ Rate limiting: Max 5 OTP attempts
    if (!user.resetOtpAttempts) user.resetOtpAttempts = 0;
    
    if (user.resetOtpAttempts >= 5) {
      user.resetOtp = undefined;
      user.resetOtpExpires = undefined;
      user.resetOtpAttempts = undefined;
      await user.save();

      return res.status(429).json({ 
        success: false,
        message: "Too many failed attempts. Please request a new OTP." 
      });
    }

    // Compare OTP
    const isValidOtp = await bcrypt.compare(sanitizedOtp, user.resetOtp);
    
    if (!isValidOtp) {
      user.resetOtpAttempts++;
      await user.save();

      return res.status(400).json({ 
        success: false,
        message: `Invalid OTP. ${5 - user.resetOtpAttempts} attempts remaining.` 
      });
    }

    // ✅ Check if new password is same as old password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ 
        success: false,
        message: "New password cannot be the same as your old password" 
      });
    }

    // Hash and update password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;

    // ✅ Clear OTP fields
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    user.resetOtpAttempts = undefined;

    await user.save();

    // ✅ FIXED: Clear rate limit attempts on successful reset
    resetAttempts.delete(sanitizedEmail);

    console.log(`✅ Password reset successfully for ${user.email}`);

    return res.status(200).json({ 
      success: true, 
      message: "Password reset successfully. You can now login with your new password." 
    });

  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to reset password. Please try again."
    });
  }
};

// ===================== VERIFY AUTH =====================
export const verifyAuth = async (req, res) => {
  try {
    // req.user is set by authMiddleware
    const user = req.user;

    // ✅ FIXED: Added validation
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: "Unauthorized" 
      });
    }

    return res.status(200).json({ 
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullname: user.fullname,
        role: user.role
      },
      accessToken: req.cookies.accessToken
    });
  } catch (error) {
    console.error("Verify auth error:", error);
    return res.status(500).json({ 
      success: false,
      message: "Verification failed" 
    });
  }
};

// ===================== LOGOUT =====================
export const logout = async (req, res) => {
  try {
    // ✅ Clear cookies with matching config
    res.clearCookie("accessToken", cookieConfig);
    res.clearCookie("refreshToken", cookieConfig);

    console.log("✅ User logged out successfully");

    return res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Logout failed"
    });
  }
};




