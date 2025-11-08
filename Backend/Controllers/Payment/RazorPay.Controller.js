import crypto from "crypto";
import { UserModel } from "../../Models/User.Model.js";
import razorpay from "../../lib/razorpay.js";

// ✅ Create Razorpay Order with plan-expiry check
export const createOrder = async (req, res) => {
  try {
    const { plan } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    // Validate plan
    if (!plan || !["verified_user", "verified_premium"].includes(plan)) {
      return res.status(400).json({ success: false, message: "Invalid plan" });
    }

    // Fetch the user's current data
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Check if user already has an active plan
    if (user.planExpiresAt && user.planExpiresAt > new Date()) {
      const remainingDays = Math.ceil(
        (user.planExpiresAt - new Date()) / (1000 * 60 * 60 * 24)
      );
      return res.status(400).json({
        success: false,
        message: `You already have an active ${user.accountType} plan. It will expire in ${remainingDays} day(s).`,
      });
    }

    // Set amount based on plan
    const amount = plan === "verified_user" ? 59 : 249;

    // Create new order
    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `receipt_${userId}_${Date.now()}`,
      notes: { userId, plan },
    });

    res.status(200).json({
      success: true,
      order,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ success: false, message: "Server Error in creating order" });
  }
};



// ✅ Razorpay Webhook — auto verification
export const razorpayWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    // Verify webhook signature
    const shasum = crypto.createHmac("sha256", webhookSecret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest("hex");

    if (digest !== signature) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    const event = req.body.event;

    if (event === "payment.captured") {
      const payment = req.body.payload.payment.entity;
      const orderId = payment.order_id;

      const orderDetails = await razorpay.orders.fetch(orderId);
      const { userId, plan } = orderDetails.notes;

      if (!userId || !plan) {
        return res.status(400).json({ success: false, message: "Invalid metadata" });
      }

      // Calculate expiry date (30 days from now)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);

      // Update user's plan and expiry
      const updatedUser = await UserModel.findByIdAndUpdate(
        userId,
        { accountType: plan, planExpiresAt: expiryDate },
        { new: true }
      );

      console.log(`✅ User ${updatedUser._id} upgraded to ${plan} (valid till ${expiryDate})`);
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ success: false, message: "Webhook processing error" });
  }
};
