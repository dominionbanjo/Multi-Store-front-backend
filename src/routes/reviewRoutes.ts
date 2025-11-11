import express from "express";
import {
  addReview,
  getReviews,
  deleteReview,
} from "../controllers/reviewController.js";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { validateAddReview } from "../utils/validations/productValidation.js";

const router = express.Router();

// ───────────────────────────────────────────────
// ⭐ PRODUCT REVIEWS ROUTES
// ───────────────────────────────────────────────

// 📖 Get all reviews for a product
// GET /api/v1/reviews/:product_id
router.get("/:product_id", getReviews);

// ➕ Add a review for a product (Authenticated users only)
// POST /api/v1/reviews/:product_id
router.post("/:product_id", authenticateUser, validateAddReview, addReview);

// ❌ Delete a review (Authenticated users only)
// DELETE /api/v1/reviews/:id
router.delete("/:id", authenticateUser, deleteReview);

export default router;
