import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import Cart from "../models/cartModel.js";
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

/** 🧾 GET: /api/v1/cart */
export const getCart = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to access your cart");

  const cartItems = await Cart.getUserCart(req.user.userId);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Cart retrieved successfully",
    cartItems,
  });
};

/** ➕ POST: /api/v1/cart */
export const addToCart = async (req: CustomRequest, res: Response) => {
  if (!req.user) throw new UnauthenticatedError("Please login to add to cart");

  const items = req.body;
  if (!Array.isArray(items) || items.length === 0)
    throw new BadRequestError("Invalid cart data");

  const cartItems = await Cart.addItems(req.user.userId, items);

  res.status(StatusCodes.CREATED).json({
    status: 1,
    success: true,
    message: "Items added to cart",
    cartItems,
  });
};

/** 🔄 PATCH: /api/v1/cart/:id */
export const updateCartItem = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to update your cart");

  const { id } = req.params;
  const { quantity } = req.body;
  if (!quantity || isNaN(quantity))
    throw new BadRequestError("Quantity is required and must be a number");

  const updatedItem = await Cart.updateItem(req.user.userId, id, quantity);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Cart item updated successfully",
    item: updatedItem,
  });
};

/** ❌ DELETE: /api/v1/cart/:id */
export const removeCartItem = async (req: CustomRequest, res: Response) => {
  if (!req.user) throw new UnauthenticatedError("Please login to remove items");

  const { id } = req.params;
  if (!id) throw new BadRequestError("Item ID is required");

  const result = await Cart.removeItem(req.user.userId, id);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: result.message,
  });
};

/** 🧹 DELETE: /api/v1/cart */
export const clearCart = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to clear your cart");

  const result = await Cart.clearCart(req.user.userId);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: result.message,
  });
};
