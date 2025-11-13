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
        subject: "🔐 Your EditCraft Verification Code",
        text: `Your OTP for verification is: ${otp}\n\nThis OTP will expire in 10 minutes.\n\nIf you didn't request this, please ignore this email.`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #ffffff;
                background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
                padding: 20px;
              }
              
              .email-container {
                max-width: 600px;
                margin: 0 auto;
                background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
                border-radius: 24px;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(206, 234, 69, 0.15);
                border: 2px solid rgba(206, 234, 69, 0.2);
              }
              
              .header {
                background: linear-gradient(135deg, #ceea45 0%, #9dff00 100%);
                padding: 40px 30px;
                text-align: center;
                position: relative;
                overflow: hidden;
              }
              
              .header::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
                animation: pulse 3s ease-in-out infinite;
              }
              
              @keyframes pulse {
                0%, 100% { transform: scale(1); opacity: 0.5; }
                50% { transform: scale(1.1); opacity: 0.8; }
              }
              
              .logo {
                font-size: 48px;
                font-weight: 900;
                color: #0a0a0a;
                text-transform: uppercase;
                letter-spacing: 2px;
                margin-bottom: 10px;
                position: relative;
                z-index: 1;
              }
              
              .tagline {
                color: #0a0a0a;
                font-size: 14px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 1px;
                position: relative;
                z-index: 1;
              }
              
              .content {
                padding: 50px 40px;
              }
              
              .title {
                font-size: 28px;
                font-weight: 700;
                color: #ffffff;
                margin-bottom: 20px;
                text-align: center;
              }
              
              .greeting {
                font-size: 16px;
                color: #b0b0b0;
                margin-bottom: 30px;
                text-align: center;
              }
              
              .otp-container {
                background: linear-gradient(135deg, rgba(206, 234, 69, 0.1) 0%, rgba(206, 234, 69, 0.05) 100%);
                border: 3px solid rgba(206, 234, 69, 0.3);
                border-radius: 20px;
                padding: 40px 30px;
                text-align: center;
                margin: 30px 0;
                position: relative;
                overflow: hidden;
              }
              
              .otp-container::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: linear-gradient(90deg, #ceea45, #9dff00, #ceea45);
                background-size: 200% 100%;
                animation: shimmer 2s linear infinite;
              }
              
              @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
              }
              
              .otp-label {
                font-size: 14px;
                color: #ceea45;
                text-transform: uppercase;
                letter-spacing: 2px;
                font-weight: 700;
                margin-bottom: 15px;
              }
              
              .otp-code {
                font-size: 56px;
                font-weight: 900;
                color: #ceea45;
                letter-spacing: 12px;
                font-family: 'Courier New', monospace;
                text-shadow: 0 0 20px rgba(206, 234, 69, 0.3);
                margin: 10px 0;
                display: inline-block;
                padding: 10px 20px;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 12px;
              }
              
              .timer {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background: rgba(239, 68, 68, 0.1);
                border: 2px solid rgba(239, 68, 68, 0.3);
                border-radius: 50px;
                padding: 12px 24px;
                margin-top: 20px;
                font-size: 14px;
                color: #ef4444;
                font-weight: 600;
              }
              
              .timer-icon {
                font-size: 18px;
                animation: tick 1s ease-in-out infinite;
              }
              
              @keyframes tick {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
              }
              
              .info-box {
                background: rgba(255, 255, 255, 0.03);
                border-left: 4px solid #ceea45;
                border-radius: 12px;
                padding: 20px 25px;
                margin: 30px 0;
              }
              
              .info-box p {
                font-size: 15px;
                color: #b0b0b0;
                margin-bottom: 8px;
                line-height: 1.6;
              }
              
              .info-box p:last-child {
                margin-bottom: 0;
              }
              
              .warning-box {
                background: rgba(239, 68, 68, 0.05);
                border: 2px solid rgba(239, 68, 68, 0.2);
                border-radius: 12px;
                padding: 20px;
                margin-top: 30px;
                text-align: center;
              }
              
              .warning-box p {
                font-size: 14px;
                color: #ef4444;
                font-weight: 600;
              }
              
              .security-tips {
                background: rgba(59, 130, 246, 0.05);
                border: 2px solid rgba(59, 130, 246, 0.2);
                border-radius: 12px;
                padding: 25px;
                margin-top: 30px;
              }
              
              .security-tips-title {
                font-size: 16px;
                font-weight: 700;
                color: #3b82f6;
                margin-bottom: 15px;
                display: flex;
                align-items: center;
                gap: 8px;
              }
              
              .security-tips ul {
                list-style: none;
                padding: 0;
              }
              
              .security-tips li {
                font-size: 14px;
                color: #b0b0b0;
                padding: 8px 0;
                padding-left: 25px;
                position: relative;
              }
              
              .security-tips li::before {
                content: '✓';
                position: absolute;
                left: 0;
                color: #3b82f6;
                font-weight: 700;
              }
              
              .footer {
                background: rgba(0, 0, 0, 0.3);
                padding: 30px 40px;
                text-align: center;
                border-top: 1px solid rgba(206, 234, 69, 0.1);
              }
              
              .social-links {
                display: flex;
                justify-content: center;
                gap: 15px;
                margin-bottom: 20px;
              }
              
              .social-link {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 40px;
                height: 40px;
                background: rgba(206, 234, 69, 0.1);
                border: 2px solid rgba(206, 234, 69, 0.2);
                border-radius: 50%;
                color: #ceea45;
                text-decoration: none;
                font-size: 18px;
                transition: all 0.3s ease;
              }
              
              .footer-text {
                font-size: 13px;
                color: #666;
                margin-bottom: 8px;
              }
              
              .footer-link {
                color: #ceea45;
                text-decoration: none;
                font-weight: 600;
              }
              
              .footer-link:hover {
                text-decoration: underline;
              }
              
              @media only screen and (max-width: 600px) {
                body {
                  padding: 10px;
                }
                
                .content {
                  padding: 30px 20px;
                }
                
                .otp-code {
                  font-size: 42px;
                  letter-spacing: 8px;
                }
                
                .logo {
                  font-size: 36px;
                }
                
                .title {
                  font-size: 24px;
                }
                
                .footer {
                  padding: 20px;
                }
              }
            </style>
          </head>
          <body>
            <div class="email-container">
              <!-- Header -->
              <div class="header">
                <div class="logo">🎬 EDITCRAFT</div>
                <div class="tagline">Create • Collaborate • Grow</div>
              </div>
              
              <!-- Content -->
              <div class="content">
                <h1 class="title">🔐 Verification Code</h1>
                <p class="greeting">Hi there! 👋<br>You're one step away from accessing your EditCraft account.</p>
                
                <!-- OTP Box -->
                <div class="otp-container">
                  <div class="otp-label">Your Verification Code</div>
                  <div class="otp-code">${otp}</div>
                  <div class="timer">
                    <span class="timer-icon">⏱️</span>
                    <span>Expires in 10 minutes</span>
                  </div>
                </div>
                
                <!-- Info Box -->
                <div class="info-box">
                  <p><strong>💡 What's this code for?</strong></p>
                  <p>Enter this code on the EditCraft verification page to complete your login or registration.</p>
                </div>
                
                <!-- Warning Box -->
                <div class="warning-box">
                  <p>🚨 Didn't request this? Please ignore this email and contact our support team immediately.</p>
                </div>
                
                <!-- Security Tips -->
                <div class="security-tips">
                  <div class="security-tips-title">
                    <span>🛡️</span>
                    <span>Security Tips</span>
                  </div>
                  <ul>
                    <li>Never share this code with anyone</li>
                    <li>EditCraft will never ask for your OTP via phone or email</li>
                    <li>This code is valid for 10 minutes only</li>
                    <li>If you didn't request this, your account may be at risk</li>
                  </ul>
                </div>
              </div>
              
              <!-- Footer -->
              <div class="footer">
                <div class="social-links">
                  <a href="https://www.editcraft.co.in" class="social-link">🌐</a>
                  <a href="mailto:support@editcraft.co.in" class="social-link">📧</a>
                </div>
                <p class="footer-text">&copy; ${new Date().getFullYear()} EditCraft. All rights reserved.</p>
                <p class="footer-text">
                  Need help? Contact us at 
                  <a href="mailto:support@editcraft.co.in" class="footer-link">support@editcraft.co.in</a>
                </p>
                <p class="footer-text" style="margin-top: 15px; font-size: 11px;">
                  This is an automated email. Please do not reply directly to this message.
                </p>
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