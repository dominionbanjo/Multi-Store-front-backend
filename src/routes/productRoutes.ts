import express from "express";
import {
  getAllProducts,
  getProduct,
  getByVendorOrStore,
  searchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  addReview,
  getReviews,
  deleteReview,
} from "../controllers/productController.js";

import {
  authenticateUser,
  authorizePermissions,
} from "../middlewares/authMiddleware.js";

import {
  validateAddReview,
  validateCreateProduct,
  validateUpdateProduct,
} from "../utils/validations/productValidation.js";

const router = express.Router();

// ───────────────────────────────────────────────
// 🧾 PUBLIC PRODUCT ROUTES
// ───────────────────────────────────────────────
router.get("/", getAllProducts); // GET /api/v1/products
router.get("/search", searchProducts); // GET /api/v1/products/search?q=keyword
router.get("/:idOrSlug", getProduct); // GET /api/v1/products/:idOrSlug
router.get("/store/:store_id", getByVendorOrStore); // GET /api/v1/products/store/:store_id
router.get("/vendor/:vendor_id", getByVendorOrStore); // GET /api/v1/products/vendor/:vendor_id

// ───────────────────────────────────────────────
// 🔐 PROTECTED PRODUCT ROUTES (Vendor or Admin only)
// ───────────────────────────────────────────────
router.post(
  "/",
  authenticateUser,
  authorizePermissions("vendor", "admin"),
  validateCreateProduct,
  createProduct
); // POST /api/v1/products

router.patch(
  "/:id",
  authenticateUser,
  authorizePermissions("vendor", "admin"),
  validateUpdateProduct,
  updateProduct
); // PATCH /api/v1/products/:id

router.delete(
  "/:id",
  authenticateUser,
  authorizePermissions("vendor", "admin"),
  deleteProduct
); // DELETE /api/v1/products/:id

// ───────────────────────────────────────────────
// ⭐ PRODUCT REVIEWS (Authenticated users only)
// ───────────────────────────────────────────────
router.get("/:product_id/reviews", getReviews); // GET /api/v1/products/:product_id/reviews

router.post(
  "/:product_id/reviews",
  authenticateUser,
  validateAddReview,
  addReview
); // POST /api/v1/products/:product_id/reviews

router.delete("/reviews/:id", authenticateUser, deleteReview); // DELETE /api/v1/products/reviews/:id

export default router;
