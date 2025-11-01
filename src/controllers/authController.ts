import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import Accounts from "../services/accountsService.js";
import { createJWT } from "../utils/auth/tokenUtil.js";
import { BadRequestError } from "../utils/errors/customError.js";

/**
 * 🧩 Register new user
 */
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

/**
 * 🔐 Login existing user
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password)
    throw new BadRequestError("Please provide email and password");

  const user = await Accounts.login(email, password);
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

/**
 * 🧾 Verify email via OTP
 */
export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  const { email, otp } = req.body;
  if (!email || !otp)
    throw new BadRequestError("Please provide both email and OTP");

  const result = await Accounts.verifyOtp(email, otp);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: result.msg,
  });
};

/**
 * 🔁 Resend OTP
 */
export const resendOtp = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;
  if (!email) throw new BadRequestError("Please provide your email");

  const result = await Accounts.resendOtp(email);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: result.msg,
  });
};

/**
 * 🆘 Forgot password (sends reset email)
 */
export const forgotPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { email } = req.body;
  if (!email) throw new BadRequestError("Please provide a valid email");

  const result = await Accounts.forgotPassword(email);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: result.msg,
  });
};

/**
 * 🔒 Reset password using token
 */
export const resetPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { token, email, password } = req.body;
  if (!token || !email || !password)
    throw new BadRequestError("Please provide all fields");

  const result = await Accounts.resetPassword(email, token, password);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: result.msg,
  });
};
