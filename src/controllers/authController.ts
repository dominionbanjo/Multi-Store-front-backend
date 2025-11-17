import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import Accounts from "../services/accountsService.js";
import { createJWT } from "../utils/auth/tokenUtil.js";
import { BadRequestError } from "../utils/errors/customError.js";
import { StoreModel } from "../config/db/models/StoreModel.js";
import { v4 as uuidv4 } from "uuid";
import { UserModel } from "../config/db/models/index.js";

/**
 * 🧩 Register new user
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  const body = req.body;
  if (!body) throw new BadRequestError("Please provide all required fields");

  // Create user through Accounts service
  const user = await Accounts.signUp(body);

  // 🏪 Automatically create a store if the account is a vendor
  if (user.account_type === "vendor") {
    const existingStore = await StoreModel.findOne({ user_id: user.id });

    if (!existingStore) {
      // Ensure store_name and username were provided
      if (!body.store_name || !body.username) {
        throw new BadRequestError(
          "Vendors must provide 'store_name' and 'username' during signup"
        );
      }

      try {
        const storeId = uuidv4();

        await StoreModel.create({
          id: storeId,
          user_id: user.id,
          store_name: body.store_name,
          description: body.description ?? null,
          logo: null,
          cover_image: null,
          rating_average: 0,
          rating_count: 0,
          category_ids: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // ✅ Link store to user
        if (Accounts.linkStoreToUser) {
          await Accounts.linkStoreToUser(user.id, storeId, body.store_name);
        }

        console.log(`🏪 Store created automatically for vendor ${user.email}`);
      } catch (err) {
        console.error("❌ Failed to create vendor store:", err);
        throw new BadRequestError("Failed to create store for vendor");
      }
    }
  }

  // 🎟️ Generate auth token
  const token = createJWT({
    userId: user.id,
    name: user.first_name,
    role: user.account_type,
    tokenVersion: user.token_version,
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
    tokenVersion: user.token_version,
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

export const logout = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.userId;

  if (!userId) {
    throw new BadRequestError("Not logged in");
  }

  // fetch user
  const user = await UserModel.findOne({ id: userId });

  if (!user) {
    throw new BadRequestError("User not found");
  }

  // update with real number
  await UserModel.update(userId, {
    token_version: user.token_version + 1,
    updated_at: new Date().toISOString(),
  });

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Logged out successfully",
  });
};
