import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import cloudinary from "cloudinary";
import User from "../services/userService.js";
import { formatImage } from "../utils/images/multer.js";
import {
  UnauthenticatedError,
  BadRequestError,
} from "../utils/errors/customError.js";

interface CustomRequest extends Request {
  user?: {
    userId: string;
    name: string;
    role: string;
  };
  file?: Express.Multer.File;
}

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

export const updateUser = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to update your profile");

  const userId = req.user.userId;
  const updateData: Record<string, any> = { ...req.body };

  const existingUser = await User.getProfile(userId);

  if (req.file) {
    const fileStr = formatImage(req.file);
    const uploaded = await cloudinary.v2.uploader.upload(fileStr, {
      use_filename: true,
      folder: "easystore",
    });

    updateData.avatar = uploaded.secure_url;
    updateData.avatar_public_id = uploaded.public_id;

    if (existingUser?.avatar_public_id) {
      await cloudinary.v2.uploader.destroy(existingUser.avatar_public_id);
    }
  }

  const updatedUser = await User.updateProfile(userId, updateData);
  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Profile updated successfully",
    user: updatedUser,
  });
};

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
