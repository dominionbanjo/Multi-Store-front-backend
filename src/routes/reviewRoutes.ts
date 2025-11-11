import express from "express";
import {
  getProductReviews,
  addReview,
  deleteReview,
} from "../controllers/reviewController.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public — get all reviews for a product
router.get("/:product_id", getProductReviews);

// Protected — only logged-in users can add/delete reviews
router.post("/:product_id", authenticateUser, addReview);
router.delete("/:id", authenticateUser, deleteReview);

export default router;
