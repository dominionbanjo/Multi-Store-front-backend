import sql from "../db/connect.js";
import validator from "validator";
import { v4 as uuidv4 } from "uuid";
import { hashPassword, comparePassword } from "../utils/auth/passwordUtil.js";
import { sendEmailVerification } from "../utils/mails/sendEmailVerification.js";
import {
  BadRequestError,
  UnauthenticatedError,
  NotFoundError,
} from "../utils/errors/customError.js";
import crypto from "crypto";
import { toUTCDate } from "../utils/time/toUTCDate.js";

/** 🧱 Type for creating a new account */
interface SignUpData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  phone_number: string;
  account_type: string;
  store_name?: string | null;
  username?: string | null;
  referral_code?: string | null;
  current_sales_channel?: string | null;
  agree_to_terms?: boolean;
}

class Accounts {
  /** 🔍 Check if user exists by email */
  static async userExist(email: string) {
    const result = await sql`SELECT * FROM users WHERE email = ${email}`;
    return result[0] || null;
  }

  /** 🧠 Sign up with OTP initialization */
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

    // ✅ Basic validation
    if (!first_name || !last_name || !email || !password || !phone_number)
      throw new BadRequestError("All required fields must be filled");

    if (!validator.isEmail(email))
      throw new BadRequestError("Invalid email address");

    if (!validator.isStrongPassword(password))
      throw new BadRequestError("Password not strong enough");

    const existing = await this.userExist(email);
    if (existing) throw new BadRequestError("User already exists");

    const id = uuidv4();
    const hash = await hashPassword(password);

    // ✅ Generate OTP and expiration (ISO string)
    const otp = crypto.randomInt(100000, 999999).toString();
    const otp_expiration = toUTCDate(10, true) as string;

    await sql`
      INSERT INTO users (
        id, first_name, last_name, phone_number, email, password,
        account_type, store_name, username, referral_code,
        current_sales_channel, agree_to_terms,
        email_verified, otp, otp_expiration
      )
      VALUES (
        ${id}, ${first_name}, ${last_name}, ${phone_number}, ${email}, ${hash},
        ${account_type || null}, ${store_name || null}, ${username || null},
        ${referral_code || null}, ${current_sales_channel || null},
        ${agree_to_terms}, false, ${otp}, ${otp_expiration}
      )
    `;

    // Send verification email
    await sendEmailVerification({ name: first_name, email, otp });

    return {
      id,
      first_name,
      last_name,
      email,
      account_type,
      created: true,
      email_verified: false,
    };
  }

  /** 🔐 Login existing user */
  static async login(email: string, password: string) {
    if (!email || !password)
      throw new BadRequestError("Please provide email and password");

    const user = await this.userExist(email);
    const genericError = new UnauthenticatedError(
      "Incorrect email or password"
    );
    if (!user) throw genericError;

    const match = await comparePassword(password, user.password);
    if (!match) throw genericError;

    if (!user.email_verified)
      throw new UnauthenticatedError("Please verify your email first");

    return {
      id: user.id,
      first_name: user.first_name,
      email: user.email,
      account_type: user.account_type,
    };
  }

  /** ✅ Verify OTP */
  static async verifyOtp(email: string, otp: string) {
    const user = await this.userExist(email);
    if (!user) throw new NotFoundError("User not found");
    if (user.email_verified) return { msg: "Email already verified" };

    const savedOtp = String(user.otp || "").trim();
    const inputOtp = String(otp).trim();

    if (!savedOtp)
      throw new BadRequestError("No OTP was generated for this user");
    if (savedOtp !== inputOtp) throw new BadRequestError("Invalid OTP");

    const expiration = new Date(String(user.otp_expiration));
    if (isNaN(expiration.getTime()))
      throw new BadRequestError("Stored OTP expiration is invalid");

    if (Date.now() > expiration.getTime())
      throw new BadRequestError("OTP has expired, please request a new one");

    await sql`
      UPDATE users
      SET email_verified = true, otp = NULL, otp_expiration = NULL
      WHERE email = ${email}
    `;

    return { msg: "Email verified successfully" };
  }

  /** 🔁 Resend OTP */
  static async resendOtp(email: string) {
    const user = await this.userExist(email);
    if (!user) throw new NotFoundError("User not found");
    if (user.email_verified) return { msg: "Email already verified" };

    const now = new Date();

    // ✅ Prevent resending if previous OTP still valid for >9 min
    if (
      user.otp_expiration &&
      new Date(user.otp_expiration).getTime() - now.getTime() > 9 * 60 * 1000
    ) {
      throw new BadRequestError("Please wait before requesting a new OTP");
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otp_expiration = toUTCDate(10, true) as string;

    await sql`
      UPDATE users
      SET otp = ${otp}, otp_expiration = ${otp_expiration}
      WHERE email = ${email}
    `;

    await sendEmailVerification({ name: user.first_name, email, otp });

    return { msg: "A new OTP has been sent to your email" };
  }
}

export default Accounts;
