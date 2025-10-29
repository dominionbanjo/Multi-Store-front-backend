import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import Wishlist from "../models/wishlistModel.js";
import { UnauthenticatedError } from "../utils/errors/customError.js";

interface CustomRequest extends Request {
  user?: { userId: string };
}

/** 🧾 GET /api/v1/wishlist */
export const getWishlist = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to access wishlist");

  const wishlist = await Wishlist.getWishlist(req.user.userId);
  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Wishlist retrieved successfully",
    wishlist,
  });
};

/** ➕ POST /api/v1/wishlist */
export const addToWishlist = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to add to wishlist");

  const wishlist = await Wishlist.addToWishlist(req.user.userId, req.body);
  res.status(StatusCodes.CREATED).json({
    status: 1,
    success: true,
    message: "Product added to wishlist successfully",
    wishlist,
  });
};

/** 🗑️ DELETE /api/v1/wishlist/:productId */
export const removeFromWishlist = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to remove from wishlist");

  const { productId } = req.params;
  await Wishlist.removeFromWishlist(req.user.userId, productId);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Product removed from wishlist",
  });
};

/** ❌ DELETE /api/v1/wishlist */
export const clearWishlist = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to clear wishlist");

  await Wishlist.clearWishlist(req.user.userId);
  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Wishlist cleared successfully",
  });
};
