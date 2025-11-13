import express from "express";
import {
  getAllProducts,
  getProduct,
  getProductsByStore,
  searchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  createStoreProduct,
} from "../controllers/productController.js";

import {
  authenticateUser,
  authorizePermissions,
} from "../middlewares/authMiddleware.js";

import {
  validateCreateProduct,
  validateUpdateProduct,
} from "../utils/validations/productValidation.js";

import upload from "../utils/images/multer.js";

const router = express.Router();

// ───────────────────────────────────────────────
// 🧾 PUBLIC PRODUCT ROUTES
// ───────────────────────────────────────────────
router.get("/", getAllProducts);
router.get("/search", searchProducts);
router.get("/store/:store_id", getProductsByStore);
router.get("/:idOrSlug", getProduct);

// ───────────────────────────────────────────────
// 🔐 PROTECTED PRODUCT ROUTES (Vendor/Admin)
// ───────────────────────────────────────────────

// ➕ CREATE PRODUCT FOR A SPECIFIC STORE

// ➕ CREATE PRODUCT (with images)
router.post(
  "/",
  authenticateUser,
  authorizePermissions("vendor", "admin"),
  upload.fields([
    { name: "image", maxCount: 1 }, // single main image
    { name: "gallery", maxCount: 10 }, // multiple gallery images
  ]),
  validateCreateProduct,
  createProduct
);

router.post(
  "/store/:store_id",
  authenticateUser,
  authorizePermissions("vendor", "admin"),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "gallery", maxCount: 10 },
  ]),
  validateCreateProduct,
  createStoreProduct
);

// ✏️ UPDATE PRODUCT (with images)
router.patch(
  "/:id",
  authenticateUser,
  authorizePermissions("vendor", "admin"),
  upload.fields([
    { name: "image", maxCount: 1 }, // optional replacement
    { name: "gallery", maxCount: 10 }, // optional gallery append/replace
  ]),
  validateUpdateProduct,
  updateProduct
);

// ❌ DELETE PRODUCT
router.delete(
  "/:id",
  authenticateUser,
  authorizePermissions("vendor", "admin"),
  deleteProduct
);

export default router;
