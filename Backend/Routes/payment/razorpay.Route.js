import express from 'express';
import { createOrder, razorpayWebhook } from '../../Controllers/Payment/RazorPay.Controller.js';
import {authMiddleware} from '../../Middleware/authMiddleware.js';

export const RazorPayRouter = express.Router()

RazorPayRouter.post("/create-order",authMiddleware(["user"]),createOrder)

RazorPayRouter.post("/webhook", express.raw({ type: "application/json" }), razorpayWebhook);