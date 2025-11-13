import express from "express";
import {
  getCart,
  addToCart,
  incrementCartItem,
  decrementCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
} from "../controllers/cartController.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";

const router = express.Router();

// 🔐 All cart routes require authentication
router.use(authenticateUser);

/**
 * 🧾 /api/v1/cart
 */
router
  .route("/")
  .get(getCart) // Get cart
  .post(addToCart) // Add items
  .delete(clearCart); // Clear cart

/**
 * 🔼 Increment quantity
 * PATCH /api/v1/cart/increment
 */
router.patch("/increment", incrementCartItem);

/**
 * 🔽 Decrement quantity
 * PATCH /api/v1/cart/decrement
 */
router.patch("/decrement", decrementCartItem);

/**
 * 🔄 Update exact quantity
 * PATCH /api/v1/cart/update
 */
router.patch("/update", updateCartItem);

/**
 * ❌ Remove specific item
 * DELETE /api/v1/cart/remove
 */
router.delete("/remove", removeCartItem);

export default router;
