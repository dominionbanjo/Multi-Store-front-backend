import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import cloudinary from "cloudinary";
import User from "../models/userModel.js";
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
}

export const getCurrentUser = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to access this route");
  const user = await User.getProfile(req.user.userId);
  res.status(StatusCodes.OK).json({ user });
};

export const updateUser = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to update your profile");

  const userId = req.user.userId;
  const updateData = { ...req.body };

  if (req.file) {
    const file = formatImage(req.file);
    const uploaded = await cloudinary.v2.uploader.upload(file, {
      use_filename: true,
      folder: "users",
    });
    updateData.avatar = uploaded.secure_url;
    updateData.avatar_public_id = uploaded.public_id;
  }

  const updatedUser = await User.updateProfile(userId, updateData);
  res
    .status(StatusCodes.OK)
    .json({ msg: "Profile updated successfully", user: updatedUser });
};

/** 🏬 Get all stores for user */
export const getUserStores = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to access stores");

  const stores = await User.getStores(req.user.userId);
  res.status(StatusCodes.OK).json({ stores });
};

/** 🏪 Update a specific store */
export const updateUserStore = async (req: CustomRequest, res: Response) => {
  const { storeId } = req.params;
  if (!storeId) throw new BadRequestError("Store ID is required");

  const updated = await User.updateStore(storeId, req.body);
  res
    .status(StatusCodes.OK)
    .json({ msg: "Store updated successfully", store: updated });
};
