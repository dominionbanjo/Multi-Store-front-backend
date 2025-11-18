import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import Wishlist from "../services/wishlistService.js";
import { UnauthenticatedError } from "../utils/errors/customError.js";

interface CustomRequest extends Request {
  user?: { userId: string };
}

/** 🧾 GET /api/v1/wishlist */
export const getWishlist = async (req: CustomRequest, res: Response) => {
  if (!req.user) throw new UnauthenticatedError("Please login");

  const result = await Wishlist.getWishlist(req.user.userId);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    ...result,
  });
};

/** ➕ POST /api/v1/wishlist */
export const addToWishlist = async (req: CustomRequest, res: Response) => {
  if (!req.user) throw new UnauthenticatedError("Please login");

  const result = await Wishlist.addToWishlist(req.user.userId, req.body);

  res.status(StatusCodes.CREATED).json({
    status: 1,
    success: true,
    ...result,
  });
};

/** 🗑️ DELETE /api/v1/wishlist/:productId */
export const removeFromWishlist = async (req: CustomRequest, res: Response) => {
  if (!req.user) throw new UnauthenticatedError("Please login");

  const result = await Wishlist.removeFromWishlist(
    req.user.userId,
    req.params.productId
  );

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    ...result,
  });
};

/** ❌ DELETE /api/v1/wishlist */
export const clearWishlist = async (req: CustomRequest, res: Response) => {
  if (!req.user) throw new UnauthenticatedError("Please login");

  const result = await Wishlist.clearWishlist(req.user.userId);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    ...result,
  });
};
