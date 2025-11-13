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
 * 🧾 GET: /api/v1/cart
 * Get full cart for logged-in user
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
 * ➕ POST: /api/v1/cart
 * Add one or multiple items to cart
 */
export const addToCart = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to add items to cart");

  const items = req.body;

  if (!Array.isArray(items) || items.length === 0)
    throw new BadRequestError("Items must be a non-empty array");

  const cart = await CartService.addItems(req.user.userId, items);

  res.status(StatusCodes.CREATED).json({
    status: 1,
    success: true,
    message: "Items added to cart",
    cart,
  });
};

/**
 * 🔼 PATCH: /api/v1/cart/increment
 */
export const incrementCartItem = async (req: CustomRequest, res: Response) => {
  if (!req.user) throw new UnauthenticatedError("Please login to modify cart");

  const { product_id, color, size, step = 1 } = req.body;

  if (!product_id) throw new BadRequestError("product_id is required");

  const cart = await CartService.incrementItem(
    req.user.userId,
    product_id,
    color ?? null,
    size ?? null,
    Number(step)
  );

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Cart item incremented",
    cart,
  });
};

/**
 * 🔽 PATCH: /api/v1/cart/decrement
 */
export const decrementCartItem = async (req: CustomRequest, res: Response) => {
  if (!req.user) throw new UnauthenticatedError("Please login to modify cart");

  const { product_id, color, size, step = 1 } = req.body;

  if (!product_id) throw new BadRequestError("product_id is required");

  const cart = await CartService.decrementItem(
    req.user.userId,
    product_id,
    color ?? null,
    size ?? null,
    Number(step)
  );

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Cart item decremented",
    cart,
  });
};

/**
 * 🔄 PATCH: /api/v1/cart/update
 * { product_id, color, size, quantity }
 */
export const updateCartItem = async (req: CustomRequest, res: Response) => {
  if (!req.user) throw new UnauthenticatedError("Please login to update cart");

  const { product_id, quantity, color, size } = req.body;

  if (!product_id) throw new BadRequestError("product_id is required");
  if (!quantity || isNaN(quantity))
    throw new BadRequestError("Valid quantity is required");

  const cart = await CartService.updateItem(
    req.user.userId,
    product_id,
    color ?? null,
    size ?? null,
    Number(quantity)
  );

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Cart item updated",
    cart,
  });
};

/**
 * ❌ DELETE: /api/v1/cart/item
 * { product_id, color, size }
 */
export const removeCartItem = async (req: CustomRequest, res: Response) => {
  if (!req.user) throw new UnauthenticatedError("Please login to remove items");

  const { product_id, color, size } = req.body;

  if (!product_id) throw new BadRequestError("product_id is required");

  const cart = await CartService.removeItem(
    req.user.userId,
    product_id,
    color ?? null,
    size ?? null
  );

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Item removed from cart",
    cart,
  });
};

/**
 * 🧹 DELETE: /api/v1/cart
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
