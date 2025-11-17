import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import CartService from "../services/cartService.js";
import {
  BadRequestError,
  UnauthenticatedError,
} from "../utils/errors/customError.js";

interface CustomRequest extends Request {
  user?: {
    userId: string;
    name: string;
    role: string;
  };
}

/**
 * GET /api/v1/cart
 */
export const getCart = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to access your cart");

  const cart = await CartService.getUserCart(req.user.userId);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Cart retrieved successfully",
    cart,
  });
};

/**
 * PATCH /api/v1/cart/update
 * Replace entire cart_items via the updateItem service
 */
export const setCartItems = async (req: CustomRequest, res: Response) => {
  if (!req.user) throw new UnauthenticatedError("Please login to update cart");

  const { items } = req.body;

  if (!Array.isArray(items))
    throw new BadRequestError("items must be an array");

  const cart = await CartService.setCartItems(req.user.userId, items);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Cart updated successfully",
    cart,
  });
};

/**
 * DELETE /api/v1/cart
 */
export const clearCart = async (req: CustomRequest, res: Response) => {
  if (!req.user) throw new UnauthenticatedError("Please login to clear cart");

  const cart = await CartService.clearCart(req.user.userId);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Cart cleared",
    cart,
  });
};
