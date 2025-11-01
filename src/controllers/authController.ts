import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import Accounts from "../services/accountsService.js";
import { createJWT } from "../utils/auth/tokenUtil.js";
import {
  BadRequestError,
  UnauthenticatedError,
} from "../utils/errors/customError.js";
import crypto from "crypto";
import { sendResetPasswordEmail } from "../utils/mails/sendResetPassword.js";
import createHash from "../utils/auth/createHash.js";
import sql from "../config/connect.js";
import { hashPassword } from "../utils/auth/passwordUtil.js";

export const register = async (req: Request, res: Response): Promise<void> => {
  const body = req.body;
  if (!body) throw new BadRequestError("Please provide all required fields");

  const user = await Accounts.signUp(body);
  const token = createJWT({
    userId: user.id,
    name: user.first_name,
    role: user.account_type,
  });

  res.status(StatusCodes.CREATED).json({
    status: 1,
    success: true,
    message: "User registered successfully",
    token,
    user,
  });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password)
    throw new BadRequestError("Please provide email and password");

  const user = await Accounts.login(email, password);

  // 🔹 Otherwise continue normally
  const token = createJWT({
    userId: user.id,
    name: user.first_name,
    role: user.account_type,
  });

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "User logged in successfully",
    token,
    user,
  });
};

export const verifyOtp = async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  if (!email || !otp)
    throw new BadRequestError("Please provide both email and OTP");

  const result = await Accounts.verifyOtp(email, otp);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Email verified successfully",
    ...result,
  });
};

export const resendOtp = async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) throw new BadRequestError("Please provide your email");

  const result = await Accounts.resendOtp(email);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "A new OTP has been sent to your email",
    ...result,
  });
};

export const forgotPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { email } = req.body;
  if (!email) throw new BadRequestError("Please provide a valid email");

  const result = await sql`SELECT * FROM users WHERE email = ${email}`;
  const user = result[0];

  if (user) {
    const passwordToken = crypto.randomBytes(70).toString("hex");
    const origin = process.env.FRONTEND_URL || "http://localhost:5173";

    await sendResetPasswordEmail({
      name: user.first_name,
      email: user.email,
      token: passwordToken,
      origin,
    });

    const tenMinutes = 1000 * 60 * 10;
    const passwordTokenExpirationDate = new Date(Date.now() + tenMinutes);

    await sql`
      UPDATE users 
      SET password_token = ${createHash(passwordToken)}, 
          password_token_expiration_date = ${passwordTokenExpirationDate}
      WHERE email = ${email}
    `;
  }

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Check your email for the reset password link",
  });
};

export const resetPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { token, email, password } = req.body;

  if (!token || !email || !password)
    throw new BadRequestError("Please provide all fields");

  const result = await sql`SELECT * FROM users WHERE email = ${email}`;
  const user = result[0];
  if (!user) throw new UnauthenticatedError("Invalid credentials");

  const hashedToken = createHash(token);
  const currentDate = new Date();

  if (
    user.password_token === hashedToken &&
    user.password_token_expiration_date > currentDate
  ) {
    const newHash = await hashPassword(password);
    await sql`
      UPDATE users
      SET password = ${newHash}, 
          password_token = NULL, 
          password_token_expiration_date = NULL
      WHERE email = ${email}
    `;

    res.status(StatusCodes.OK).json({
      status: 1,
      success: true,
      message: "Password reset successful",
    });
  } else {
    throw new UnauthenticatedError("Invalid or expired token");
  }
};
