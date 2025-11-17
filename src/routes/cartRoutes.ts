import express from "express";
import {
  getCart,
  setCartItems,
  clearCart,
} from "../controllers/cartController.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";

const router = express.Router();

// All cart routes require authentication
router.use(authenticateUser);

/**
 * /api/v1/cart
 */
router
  .route("/")
  .get(getCart) // Get user cart
  .delete(clearCart); // Clear cart completely

/**
 * PATCH /api/v1/cart/update
 * Update entire cart_items array
 */
router.patch("/update", setCartItems);

export default router;
