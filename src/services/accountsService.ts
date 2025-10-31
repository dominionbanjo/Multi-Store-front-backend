import validator from "validator";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";

import { hashPassword, comparePassword } from "../utils/auth/passwordUtil.js";
import { sendEmailVerification } from "../utils/mails/sendEmailVerification.js";
import {
  BadRequestError,
  UnauthenticatedError,
  NotFoundError,
} from "../utils/errors/customError.js";
import { toUTCDate } from "../utils/time/toUTCDate.js";
// import { UserModel } from "../models/UserModel";
import { UserModel } from "../config/db/models/UserModel.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

interface SignUpData {
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
}

class Accounts {
  /** ───────────────────────────────
   * Utility: Find user by email
   * ─────────────────────────────── */
  static async userExist(email: string) {
    const user = await UserModel.findOne({ email });
    return user;
  }

  /** ───────────────────────────────
   * Normal signup (password)
   * ─────────────────────────────── */
  static async signUp(data: SignUpData) {
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

    // Validation
    if (!first_name || !last_name || !email || !password)
      throw new BadRequestError("All required fields must be filled");

    if (!validator.isEmail(email))
      throw new BadRequestError("Invalid email address");

    if (!validator.isStrongPassword(password))
      throw new BadRequestError("Password not strong enough");

    const existing = await this.userExist(email);
    if (existing) throw new BadRequestError("User already exists");

    // Prepare user data
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
      store_name,
      username,
      referral_code,
      current_sales_channel,
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

  /** ───────────────────────────────
   * Login with password
   * ─────────────────────────────── */
  static async login(email: string, password?: string) {
    if (!email) throw new BadRequestError("Please provide email");

    const user = await this.userExist(email);
    const genericError = new UnauthenticatedError(
      "Incorrect email or password"
    );
    if (!user) throw genericError;

    if (user.signup_medium === "google") {
      throw new BadRequestError("This account is Google Sign-In only");
    }

    if (!password) throw genericError;
    const match = await comparePassword(password, user.password || "");
    if (!match) throw genericError;

    if (!user.email_verified) return { ...user, email_verified: false };

    return user;
  }

  /** ───────────────────────────────
   * Google Sign-In / Continue
   * ─────────────────────────────── */
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
      });
    }

    return user;
  }

  /** ───────────────────────────────
   * Verify OTP
   * ─────────────────────────────── */
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

  /** ───────────────────────────────
   * Resend OTP
   * ─────────────────────────────── */
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
}

export default Accounts;
