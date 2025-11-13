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
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <style>
              body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:20px;background:#0a0a0a}
              .card{max-width:500px;margin:0 auto;background:linear-gradient(135deg,#1a1a1a,#0a0a0a);border-radius:20px;border:2px solid rgba(206,234,69,.2);overflow:hidden;box-shadow:0 10px 30px rgba(206,234,69,.1)}
              .header{background:linear-gradient(135deg,#ceea45,#9dff00);padding:30px 20px;text-align:center}
              .logo{font-size:32px;font-weight:900;color:#0a0a0a;margin:0}
              .otp-box{background:rgba(206,234,69,.1);border:2px solid rgba(206,234,69,.3);border-radius:16px;padding:30px 20px;margin:30px 20px;text-align:center;position:relative}
              .otp-box::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#ceea45,#9dff00,#ceea45);background-size:200% 100%;animation:s 2s linear infinite}
              @keyframes s{to{background-position:200% 0}}
              .label{font-size:12px;color:#ceea45;text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:10px}
              .code{font-size:48px;font-weight:900;color:#ceea45;letter-spacing:10px;font-family:monospace;text-shadow:0 0 15px rgba(206,234,69,.3);background:rgba(0,0,0,.3);padding:10px 20px;border-radius:10px;display:inline-block}
              .timer{color:#ef4444;font-size:13px;margin-top:15px;font-weight:600}
              .footer{padding:20px;text-align:center;color:#666;font-size:12px;border-top:1px solid rgba(206,234,69,.1)}
              .footer a{color:#ceea45;text-decoration:none}
              @media(max-width:600px){.code{font-size:36px;letter-spacing:6px}}
            </style>
          </head>
          <body>
            <div class="card">
              <div class="header">
                <div class="logo">🎬 EDITCRAFT</div>
              </div>
              <div class="otp-box">
                <div class="label">Your Verification Code</div>
                <div class="code">${otp}</div>
                <div class="timer">⏱️ Expires in 10 minutes</div>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} EditCraft. All rights reserved.</p>
                <p>Need help? <a href="mailto:support@editcraft.co.in">support@editcraft.co.in</a></p>
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