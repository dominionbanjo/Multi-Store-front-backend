import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import cloudinary from "cloudinary";
import User from "../services/userService.js";
import Store from "../services/storeService.js";
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

/** 👤 Get current user profile */
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

/** ✏️ Update user profile (form-data) */
export const updateUser = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to update your profile");

  const userId = req.user.userId;
  const updateData: Record<string, any> = { ...req.body };

  // Parse address JSON if provided
  if (typeof updateData.address === "string") {
    try {
      updateData.address = JSON.parse(updateData.address);
    } catch {
      throw new BadRequestError("Invalid address JSON format");
    }
  }

  const updatedUser = await User.updateProfile(
    userId,
    updateData,
    req.file // <-- file is now handled inside the service
  );

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Profile updated successfully",
    user: updatedUser,
  });
};

/** 🏬 Get all user stores */
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

/** 👥 Get all users (admin only) */
export const getAllUsers = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { page = 1, limit = 20 } = req.query;

  const { users, pagination } = await User.getAllUsers({
    page: Number(page),
    limit: Number(limit),
  });

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "All users retrieved successfully",
    users,
    pagination,
  });
};
