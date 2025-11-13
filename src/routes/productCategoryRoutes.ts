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
  validateCreateCategory,
  validateUpdateCategory,
} from "../utils/validations/categoryValidation.js";

const router = express.Router();

/**
 * 🌍 Public Routes
 */
router.get("/", getAllCategories);
router.get("/:idOrSlug", getCategory);
router.get("/:idOrSlug/subcategories", getSubcategories);

/**
 * 🔒 Protected (Admin)
 */
router.post("/", validateCreateCategory, createCategory);
router.patch("/:id", validateUpdateCategory, updateCategory);
router.delete("/:id", deleteCategory);

export default router;
