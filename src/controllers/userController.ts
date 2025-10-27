import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import cloudinary from "cloudinary";
import User from "../models/userModel.js";
import { formatImage } from "../utils/images/multer.js";
import {
  UnauthenticatedError,
  BadRequestError,
} from "../utils/errors/customError.js";

/** Extend Express Request to include user + file */
interface CustomRequest extends Request {
  user?: {
    userId: string;
    name: string;
    role: string;
  };
  file?: Express.Multer.File;
}

/** 🧠 Get current logged-in user */
export const getCurrentUser = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to access this route");

  const user = await User.getProfile(req.user.userId);
  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "User profile retrieved successfully",
    user,
  });
};

/** ✏️ Update user profile */
export const updateUser = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to update your profile");

  const userId = req.user.userId;
  const updateData: Record<string, any> = { ...req.body };

  // ✅ Handle avatar upload
  if (req.file) {
    const fileStr = formatImage(req.file);
    const uploaded = await cloudinary.v2.uploader.upload(fileStr, {
      use_filename: true,
      folder: "users",
    });

    updateData.avatar = uploaded.secure_url;
    updateData.avatar_public_id = uploaded.public_id;
  }

  const updatedUser = await User.updateProfile(userId, updateData);
  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Profile updated successfully",
    user: updatedUser,
  });
};

/** 🏬 Get all stores belonging to a user */
export const getUserStores = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to access stores");

  const stores = await User.getStores(req.user.userId);
  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "User stores retrieved successfully",
    stores,
  });
};

/** 🏪 Update a specific store */
export const updateUserStore = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const { storeId } = req.params as { storeId?: string };
  if (!storeId) throw new BadRequestError("Store ID is required");

  const updated = await User.updateStore(storeId, req.body);
  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Store updated successfully",
    store: updated,
  });
};
