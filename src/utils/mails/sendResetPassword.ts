import { sendEmail } from "./sendEmail.js";

interface ResetPasswordEmail {
  name: string;
  email: string;
  token: string;
  origin: string;
}

export const sendResetPasswordEmail = async ({
  name,
  email,
  token,
  origin,
}: ResetPasswordEmail) => {
  const resetURL = `${origin}/auth/reset-password?token=${token}&email=${email}`;

  const html = `
  <div style="
    background-color:#f9fafb;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 40px 0;
    color: #1e1e1e;
  ">
    <table width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="
            background-color:#ffffff;
            border-radius:12px;
            padding:40px;
            box-shadow:0 2px 12px rgba(0,0,0,0.05);
          ">
            <tr>
              <td align="center" style="padding-bottom: 24px;">
                <img src="https://yourwebsite.com/logo.png" alt="easyStore" width="120" style="display:block;" />
              </td>
            </tr>

            <tr>
              <td style="font-size:18px; font-weight:600; color:#111827;">
                Hello, ${name}
              </td>
            </tr>

            <tr>
              <td style="padding:16px 0; font-size:15px; color:#374151; line-height:1.6;">
                We received a request to reset your password. Click the button below to securely reset it. 
                If you didn’t request this, you can safely ignore this email.
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:24px 0;">
                <a href="${resetURL}" style="
                  background-color:#1f2937;
                  color:#ffffff;
                  text-decoration:none;
                  font-weight:600;
                  padding:14px 32px;
                  border-radius:8px;
                  display:inline-block;
                  transition: background-color 0.3s ease;
                ">Reset Password</a>
              </td>
            </tr>

            <tr>
              <td style="font-size:14px; color:#6b7280; line-height:1.6; padding-top:12px;">
                This link will expire in 10 minutes for your security.<br />
                If the button above doesn’t work, copy and paste the following link into your browser:
              </td>
            </tr>

            <tr>
              <td style="padding-top:8px; word-break:break-all; color:#2563eb; font-size:13px;">
                <a href="${resetURL}" style="color:#2563eb;">${resetURL}</a>
              </td>
            </tr>

            <tr>
              <td style="padding-top:32px; font-size:13px; color:#9ca3af; border-top:1px solid #e5e7eb; padding-top:20px; text-align:center;">
                © ${new Date().getFullYear()} easyStore. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
  `;

  return sendEmail({
    to: email,
    subject: "Reset your easyStore password",
    html,
  });
};
