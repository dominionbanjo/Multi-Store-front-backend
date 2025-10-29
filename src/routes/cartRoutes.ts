import express from "express";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} from "../controllers/cartController.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";

const router = express.Router();

// 🧠 All routes require authentication
router.use(authenticateUser);

router.route("/").get(getCart).post(addToCart).delete(clearCart);

router.route("/:id").patch(updateCartItem).delete(removeCartItem);

export default router;
