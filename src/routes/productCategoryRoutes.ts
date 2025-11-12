import express from "express";
import {
  createCategory,
  getAllCategories,
  getCategory,
  updateCategory,
  deleteCategory,
  getSubcategories,
} from "../controllers/productCategoryController.js";
import {
  authenticateUser,
  authorizePermissions,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * 🌍 Public Routes
 */
router.get("/", getAllCategories);
router.get("/:idOrSlug", getCategory);
router.get("/parent/:parent_id/subcategories", getSubcategories);

/**
 * 🔒 Protected (Admin)
 */
router.post(
  "/",
  authenticateUser,
  authorizePermissions("admin"),
  createCategory
);
router.patch(
  "/:id",
  authenticateUser,
  authorizePermissions("admin"),
  updateCategory
);
router.delete(
  "/:id",
  authenticateUser,
  authorizePermissions("admin"),
  deleteCategory
);

export default router;
