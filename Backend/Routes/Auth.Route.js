import express from 'express';
export const AuthRouter = express.Router();

import { 
  signup, 
  verifyOTP, 
  resendSignupOTP, // ✅ Import missing controller
  login, 
  forgotPassword, 
  resetPassword,
  logout, 
  verifyAuth 
} from '../Controllers/Auth.Controller.js';

import { authMiddleware } from '../Middleware/authMiddleware.js';

// ===================== RATE LIMITING (Optional but Recommended) =====================
import rateLimit from 'express-rate-limit';

// General rate limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: { 
    success: false, 
    message: "Too many requests, please try again later." 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for OTP routes
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 requests per window
  message: { 
    success: false, 
    message: "Too many OTP requests, please try again later." 
  },
});

// Login rate limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { 
    success: false, 
    message: "Too many login attempts, please try again later." 
  },
});

// ===================== VALIDATION MIDDLEWARE (Optional) =====================
import { body, validationResult } from 'express-validator';

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: "Validation failed", 
      errors: errors.array() 
    });
  }
  next();
};

// Signup validation
const signupValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  body('username').isLength({ min: 3, max: 20 }).trim().withMessage('Username must be 3-20 characters'),
  body('fullname').isLength({ min: 2 }).trim().withMessage('Full name is required'),
  body('password').isLength({ min: 6, max: 20 }).withMessage('Password must be 6-20 characters'),
];

// Login validation
const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  body('password').notEmpty().withMessage('Password is required'),
];

// OTP validation
const otpValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  body('otp').isLength({ min: 4, max: 6 }).withMessage('Invalid OTP format'),
];

// Reset password validation
const resetPasswordValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  body('otp').isLength({ min: 4, max: 6 }).withMessage('Invalid OTP format'),
  body('newPassword').isLength({ min: 6, max: 20 }).withMessage('Password must be 6-20 characters'),
];

// ===================== PUBLIC ROUTES =====================

// ✅ Signup route - Register new user
AuthRouter.post('/signup', authLimiter, signupValidation, validateRequest, signup);

// ✅ Verify OTP route - Confirm email after signup
AuthRouter.post('/verify-otp', otpLimiter, otpValidation, validateRequest, verifyOTP);

// ✅ Resend OTP route - Resend verification OTP (MISSING IN YOUR CODE)
AuthRouter.post('/resend-otp', otpLimiter, 
  [body('email').isEmail().normalizeEmail()], 
  validateRequest, 
  resendSignupOTP
);

// ✅ Login route - Authenticate user
AuthRouter.post('/login', loginLimiter, loginValidation, validateRequest, login);

// ✅ Forgot password route - Send password reset OTP
AuthRouter.post('/forgot-password', otpLimiter, 
  [body('email').isEmail().normalizeEmail()], 
  validateRequest, 
  forgotPassword
);

// ✅ Reset password route - Verify OTP & update password
AuthRouter.post('/reset-password', authLimiter, resetPasswordValidation, validateRequest, resetPassword);

// ✅ Verify authentication - Check if user is authenticated
AuthRouter.get('/verify', authMiddleware(["user", "admin"]), verifyAuth);

// ===================== PROTECTED ROUTES =====================

// ✅ Logout route - Should be protected (only logged-in users can logout)
AuthRouter.post('/logout', authMiddleware(["user", "admin", "super_admin"]), logout);

// ✅ Refresh token route (RECOMMENDED TO ADD)
// AuthRouter.post('/refresh-token', refreshToken);

// ✅ Change password route - For logged-in users (RECOMMENDED TO ADD)
// AuthRouter.post('/change-password', authMiddleware(["user", "admin"]), changePassword);

// ✅ Get current user profile (RECOMMENDED TO ADD)
// AuthRouter.get('/me', authMiddleware(["user", "admin"]), getCurrentUser);

// ✅ Update profile (RECOMMENDED TO ADD)
// AuthRouter.put('/profile', authMiddleware(["user", "admin"]), updateProfile);

// ✅ Delete account (RECOMMENDED TO ADD)
// AuthRouter.delete('/account', authMiddleware(["user", "admin"]), deleteAccount);

export default AuthRouter;