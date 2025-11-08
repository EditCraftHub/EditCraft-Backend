// middlewares/authMiddleware.js
import jwt from "jsonwebtoken";
import { UserModel } from "../Models/User.Model.js";
import dotenv from "dotenv";

dotenv.config();

// Role hierarchy: higher roles include all lower roles
const roleHierarchy = {
  user: 1,
  admin: 2,
  super_admin: 3,
};

export const authMiddleware = (allowedRoles = []) => {
  if (typeof allowedRoles === "string") allowedRoles = [allowedRoles];

  return async (req, res, next) => {
    try {
      // ✅ Check accessToken, not refreshToken
      const token = req.cookies?.accessToken;
      
      if (!token) {
        return res.status(401).json({ 
          success: false, 
          message: "No token provided" 
        });
      }

      // Verify token
      let decoded;
      try {
        // ✅ Use ACCESS_TOKEN_SECRET
        decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      } catch (error) {
        return res.status(401).json({ 
          success: false, 
          message: "Invalid or expired token" 
        });
      }

      // Get user from DB
      const user = await UserModel.findById(decoded.id).select("-password -otp -otpExpires");
      
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          message: "User not found" 
        });
      }

      // Check if user is verified
      if (!user.isVerified) {
        return res.status(401).json({ 
          success: false, 
          message: "User not verified" 
        });
      }

      // Hierarchical role check (only if roles are specified)
      if (allowedRoles.length > 0) {
        const userRoleLevel = roleHierarchy[user.role] || 0;
        const minAllowedLevel = Math.min(
          ...allowedRoles.map((role) => roleHierarchy[role] || Infinity)
        );

        if (userRoleLevel < minAllowedLevel) {
          return res.status(403).json({ 
            success: false, 
            message: "Forbidden: Insufficient permissions" 
          });
        }
      }

      req.user = user; // attach user to request
      next();
    } catch (err) {
      console.error("Auth Middleware Error:", err);
      res.status(500).json({ 
        success: false, 
        message: "Something went wrong" 
      });
    }
  };
};

// Optional convenience middlewares
export const userAuth = authMiddleware("user");
export const adminAuth = authMiddleware(["admin"]);
export const superAdminAuth = authMiddleware(["super_admin"]);