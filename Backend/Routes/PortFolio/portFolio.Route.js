import express from 'express';
import { authMiddleware } from '../../Middleware/authMiddleware.js';
import { addMedia, getPortfolioByUser, updatePortfolio } from '../../Controllers/portfolio/Portfolio.Controller.js';
import upload from '../../Middleware/uploadMiddleware.js';

export const PortfolioRouter = express.Router();

// Update bio, description, social links, visibility
PortfolioRouter.put(
  '/update-portfolio',
  authMiddleware(["user"]),
  updatePortfolio
);

// Upload photos/videos with Multer memory storage
// Use 'photos' and 'videos' as the field names
PortfolioRouter.post(
  '/upload-media',
  authMiddleware(["user"]),
  upload.fields([
    { name: 'photos', maxCount: 50 },   // enforce maxCount for extra safety
    { name: 'videos', maxCount: 100 }
  ]),
  addMedia
);

// Get a portfolio by username (public route)
PortfolioRouter.get(
  '/get-portfolio/:username',
  getPortfolioByUser
);