import { sendEmail } from "./sendEmail.js";

interface IEmailVerification {
  name: string;
  email: string;
  otp: string;
}

export const sendEmailVerification = async ({
  name,
  email,
  otp,
}: IEmailVerification) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; background: #fff; border-radius: 10px; padding: 20px; border: 1px solid #eee;">
      <div style="text-align: center;">
        <img src="https://easystore01.netlify.app/logos/inline-stripe.png" alt="Logo" width="120" />
      </div>
      <h2 style="color: #333; text-align: center;">Verify Your Email Address</h2>
      <p style="color: #555;">Hi <b>${name}</b>,</p>
      <p style="color: #555;">Thank you for signing up. Please use the OTP below to verify your email address. It expires in <b>10 minutes</b>.</p>
      <div style="text-align: center; font-size: 24px; font-weight: bold; color: #007bff; letter-spacing: 4px; margin: 20px 0;">
        ${otp}
      </div>
      <p style="color: #777;">If you didn’t request this, please ignore this email.</p>
      <p style="font-size: 12px; color: #999; text-align: center;">© ${new Date().getFullYear()} EasyStore. All rights reserved.</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: "Verify Your EasyStore Account",
    html,
  });
};
