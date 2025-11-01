import validator from "validator";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";

import { hashPassword, comparePassword } from "../utils/auth/passwordUtil.js";
import { sendEmailVerification } from "../utils/mails/sendEmailVerification.js";
import { sendResetPasswordEmail } from "../utils/mails/sendResetPassword.js";
import createHash from "../utils/auth/createHash.js";
import { toUTCDate } from "../utils/time/toUTCDate.js";
import {
  BadRequestError,
  UnauthenticatedError,
  NotFoundError,
} from "../utils/errors/customError.js";
import { UserModel } from "../config/db/models/UserModel.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Core service for all account-related logic:
 * - Registration / Login
 * - Google sign-in
 * - OTP verification & resending
 * - Password reset workflow
 */
class Accounts {
  /** 🔍 Utility: Find user by email */
  static async userExist(email: string) {
    if (!email) throw new BadRequestError("Email is required");
    const user = await UserModel.findOne({ email });
    return user;
  }

  // ───────────────────────────────────────────────
  // 🧾 NORMAL SIGNUP
  // ───────────────────────────────────────────────
  static async signUp(data: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    phone_number?: string | null;
    account_type: string;
    store_name?: string | null;
    username?: string | null;
    referral_code?: string | null;
    current_sales_channel?: string | null;
    agree_to_terms?: boolean;
  }) {
    const {
      first_name,
      last_name,
      email,
      password,
      phone_number,
      account_type,
      store_name,
      username,
      referral_code,
      current_sales_channel,
      agree_to_terms = true,
    } = data;

    // ✅ Validation
    if (!first_name || !last_name || !email || !password)
      throw new BadRequestError("All required fields must be filled");

    if (!validator.isEmail(email))
      throw new BadRequestError("Invalid email address");

    if (!validator.isStrongPassword(password))
      throw new BadRequestError("Password not strong enough");

    const existing = await this.userExist(email);
    if (existing) throw new BadRequestError("User already exists");

    // ✅ Create user
    const id = uuidv4();
    const hash = await hashPassword(password);
    const otp = crypto.randomInt(100000, 999999).toString();
    const otp_expiration = toUTCDate(10, true) as string;

    const user = await UserModel.create({
      id,
      first_name,
      last_name,
      phone_number: phone_number || null,
      email,
      password: hash,
      account_type: account_type || "user",
      store_name: store_name || null,
      username: username || null,
      referral_code: referral_code || null,
      current_sales_channel: current_sales_channel || null,
      agree_to_terms,
      email_verified: false,
      otp,
      otp_expiration,
      signup_medium: "signed",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await sendEmailVerification({ name: first_name, email, otp });

    return {
      id,
      first_name,
      last_name,
      email,
      account_type,
      email_verified: false,
      signup_medium: "signed",
    };
  }

  // ───────────────────────────────────────────────
  // 🔐 LOGIN
  // ───────────────────────────────────────────────
  static async login(email: string, password?: string) {
    if (!email) throw new BadRequestError("Please provide email");

    const user = await this.userExist(email);
    const genericError = new UnauthenticatedError(
      "Incorrect email or password"
    );
    if (!user) throw genericError;

    // ⛔ If Google account, block password login
    if (user.signup_medium === "google") {
      throw new BadRequestError("This account uses Google Sign-In only");
    }

    if (!password) throw genericError;
    const match = await comparePassword(password, user.password || "");
    if (!match) throw genericError;

    // ⚠️ Return if email not verified yet
    if (!user.email_verified) return { ...user, email_verified: false };

    return user;
  }

  // ───────────────────────────────────────────────
  // 🧭 GOOGLE SIGN-IN / CONTINUE
  // ───────────────────────────────────────────────
  static async continueWithGoogle(token: string) {
    if (!token) throw new BadRequestError("Missing Google token");

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) throw new BadRequestError("Invalid Google token");

    const { email, name, picture, email_verified } = payload;
    if (!email) throw new BadRequestError("Google account has no email");
    if (!name)
      throw new BadRequestError("Google account has no name information");

    const [first_name, last_name] = name.trim().split(" ");
    let user = await this.userExist(email);

    if (!user) {
      const id = uuidv4();
      user = await UserModel.create({
        id,
        first_name,
        last_name,
        email,
        email_verified: email_verified ?? true,
        account_type: "user",
        avatar: picture || null,
        agree_to_terms: true,
        signup_medium: "google",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return user;
  }

  // ───────────────────────────────────────────────
  // ✅ VERIFY OTP
  // ───────────────────────────────────────────────
  static async verifyOtp(email: string, otp: string) {
    const user = await this.userExist(email);
    if (!user) throw new NotFoundError("User not found");
    if (user.email_verified) return { msg: "Email already verified" };

    if (String(user.otp).trim() !== String(otp).trim())
      throw new BadRequestError("Invalid OTP");

    const expiration = new Date(String(user.otp_expiration));
    if (Date.now() > expiration.getTime())
      throw new BadRequestError("OTP has expired");

    await UserModel.update(user.id, {
      email_verified: true,
      otp: null,
      otp_expiration: null,
    });

    return { msg: "Email verified successfully" };
  }

  // ───────────────────────────────────────────────
  // 🔁 RESEND OTP
  // ───────────────────────────────────────────────
  static async resendOtp(email: string) {
    const user = await this.userExist(email);
    if (!user) throw new NotFoundError("User not found");
    if (user.email_verified)
      throw new BadRequestError("Email already verified");

    const now = new Date();
    if (
      user.otp_expiration &&
      new Date(user.otp_expiration).getTime() - now.getTime() > 9 * 60 * 1000
    ) {
      throw new BadRequestError("Please wait before requesting a new OTP");
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otp_expiration = toUTCDate(10, true) as string;

    await UserModel.update(user.id, { otp, otp_expiration });
    await sendEmailVerification({ name: user.first_name, email, otp });

    return { msg: "A new OTP has been sent to your email" };
  }

  // ───────────────────────────────────────────────
  // 🔁 FORGOT PASSWORD
  // ───────────────────────────────────────────────
  static async forgotPassword(email: string) {
    if (!email) throw new BadRequestError("Please provide a valid email");

    const user = await this.userExist(email);
    if (!user) return { msg: "Check your email for the reset password link" };

    const passwordToken = crypto.randomBytes(70).toString("hex");
    const origin = process.env.FRONTEND_URL || "http://localhost:5173";
    const expiration = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await sendResetPasswordEmail({
      name: user.first_name,
      email: user.email,
      token: passwordToken,
      origin,
    });

    await UserModel.update(user.id, {
      password_token: createHash(passwordToken),
      password_token_expiration_date: expiration.toISOString(),
    });

    return { msg: "Check your email for the reset password link" };
  }

  // ───────────────────────────────────────────────
  // 🔐 RESET PASSWORD
  // ───────────────────────────────────────────────
  static async resetPassword(email: string, token: string, password: string) {
    if (!token || !email || !password)
      throw new BadRequestError("Please provide all fields");

    const user = await this.userExist(email);
    if (!user) throw new UnauthenticatedError("Invalid credentials");

    const hashedToken = createHash(token);
    const now = new Date();

    if (
      user.password_token === hashedToken &&
      user.password_token_expiration_date &&
      new Date(user.password_token_expiration_date) > now
    ) {
      const newHash = await hashPassword(password);
      await UserModel.update(user.id, {
        password: newHash,
        password_token: null,
        password_token_expiration_date: null,
      });

      return { msg: "Password reset successful" };
    }

    throw new UnauthenticatedError("Invalid or expired token");
  }
}

export default Accounts;
