import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// Create Notify Schema
const NotifySchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const NotifyModel = mongoose.model('Notify', NotifySchema);

// Subscribe endpoint
router.post('/subscribe', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Validate email
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide a valid email address' 
      });
    }

    // Check if already subscribed
    const existing = await NotifyModel.findOne({ email });
    if (existing) {
      return res.status(200).json({ 
        success: true, 
        message: 'You\'re already on our list! 🎉' 
      });
    }

    // Save to database
    await NotifyModel.create({ email });

    res.status(201).json({ 
      success: true, 
      message: 'Thank you! We\'ll notify you when we launch! 🚀' 
    });
  } catch (error) {
    console.error('Notify subscription error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Something went wrong. Please try again.' 
    });
  }
});

// Get all subscribers (admin endpoint)
router.get('/subscribers', async (req, res) => {
  try {
    const subscribers = await NotifyModel.find().sort({ createdAt: -1 });
    res.json({ 
      success: true, 
      count: subscribers.length, 
      data: subscribers 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

export const NotifyRouter = router;