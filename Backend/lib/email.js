// lib/email.js
import dotenv from "dotenv";

dotenv.config();

export const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

export const sendOtpEmail = async (toEmail, otp) => {
  try {
    console.log("📧 Sending email via Mailtrap API...");
    console.log("To:", toEmail);
    console.log("OTP:", otp);

    const response = await fetch("https://send.api.mailtrap.io/api/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.MAILTRAP_API_TOKEN}`,
      },
      body: JSON.stringify({
        from: {
          email: process.env.MAIL_FROM,
          name: "EditCraft"
        },
        to: [{ email: toEmail }],
        subject: "OTP Verification - EditCraft",
        text: `Your OTP for verification is: ${otp}\n\nThis OTP will expire in 10 minutes.\n\nIf you didn't request this, please ignore this email.`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .otp-box { background-color: #f4f4f4; border: 2px dashed #007bff; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
              .otp-code { font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 5px; }
              .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>OTP Verification</h2>
              <p>Hello,</p>
              <p>Your One-Time Password (OTP) for verification is:</p>
              <div class="otp-box">
                <div class="otp-code">${otp}</div>
              </div>
              <p><strong>Note:</strong> This OTP will expire in 10 minutes.</p>
              <p>If you didn't request this verification, please ignore this email.</p>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} EditCraft. All rights reserved.</p>
                <p>This is an automated email. Please do not reply.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        category: "OTP Verification"
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Mailtrap API Error:", data);
      throw new Error(data.errors?.[0] || "Failed to send email");
    }

    console.log(`✅ OTP sent to ${toEmail} | Success: ${data.success}`);
    return { success: true, messageId: data.message_ids?.[0] };
  } catch (error) {
    console.error(`❌ Failed to send OTP:`, error.message);
    throw error;
  }
};