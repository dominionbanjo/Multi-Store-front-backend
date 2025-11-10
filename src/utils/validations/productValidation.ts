import { body } from "express-validator";
import { withValidationErrors } from "../../middlewares/withValidationErrors.js";
import sql from "../../config/connect.js";

/**
 * 🧾 Validate product creation
 */
export const validateCreateProduct = withValidationErrors([
  body("name")
    .notEmpty()
    .withMessage("Product name is required")
    .isString()
    .withMessage("Invalid product name"),

  body("slug")
    .optional()
    .isSlug()
    .withMessage("Slug must be URL-friendly")
    .custom(async (slug) => {
      const result = await sql`SELECT id FROM products WHERE slug = ${slug}`;
      if (result.length > 0) throw new Error("Slug already in use");
    }),

  body("category_id")
    .notEmpty()
    .withMessage("Category ID is required")
    .isUUID()
    .withMessage("Invalid category ID format")
    .custom(async (category_id) => {
      const result =
        await sql`SELECT id FROM product_categories WHERE id = ${category_id}`;
      if (result.length === 0)
        throw new Error("Category does not exist in product_categories");
    }),

  body("price")
    .notEmpty()
    .withMessage("Price is required")
    .isFloat({ gt: 0 })
    .withMessage("Price must be a positive number"),

  body("discount_price")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("Discount price must be positive"),

  body("stock")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Stock must be a non-negative integer"),

  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string"),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array of strings"),
]);

/**
 * ✏️ Validate product update
 */
export const validateUpdateProduct = withValidationErrors([
  body("name").optional().isString().withMessage("Invalid product name"),

  body("slug")
    .optional()
    .isSlug()
    .withMessage("Slug must be URL-friendly")
    .custom(async (slug, { req }) => {
      const productId = req.params?.id ?? null; // ✅ safe access
      const result = await sql`SELECT id FROM products WHERE slug = ${slug}`;
      const product = result[0];
      if (product && product.id !== productId) {
        throw new Error("Slug already in use by another product");
      }
    }),

  body("category_id")
    .optional()
    .isUUID()
    .withMessage("Invalid category ID format")
    .custom(async (category_id) => {
      const result =
        await sql`SELECT id FROM product_categories WHERE id = ${category_id}`;
      if (result.length === 0)
        throw new Error("Category does not exist in product_categories");
    }),

  body("price")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("Price must be a positive number"),

  body("discount_price")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("Discount price must be positive"),

  body("stock")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Stock must be a non-negative integer"),

  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string"),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array of strings"),
]);

/**
 * ⭐ Validate adding a product review
 */
export const validateAddReview = withValidationErrors([
  body("rating")
    .notEmpty()
    .withMessage("Rating is required")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),

  body("comment").optional().isString().withMessage("Comment must be a string"),

  body("product_id")
    .optional() // may come from body or route param
    .isUUID()
    .withMessage("Invalid product ID format")
    .custom(async (product_id, { req }) => {
      // ✅ Safe access using optional chaining
      const pid = product_id || req.params?.product_id;
      if (!pid) throw new Error("Missing product ID");

      const result = await sql`SELECT id FROM products WHERE id = ${pid}`;
      if (result.length === 0) throw new Error("Product does not exist");
    }),
]);
