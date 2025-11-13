import { body } from "express-validator";
import { withValidationErrors } from "../../middlewares/withValidationErrors.js";
import sql from "../../config/connect.js";
const ALLOWED_CREATE_CATEGORY_FIELDS = ["name", "slug", "parent_id"];
const ALLOWED_UPDATE_CATEGORY_FIELDS = ["name", "slug", "parent_id"];

export const validateCreateCategory = withValidationErrors(
  [
    body("name")
      .notEmpty()
      .withMessage("Category name is required")
      .isString()
      .withMessage("Invalid category name")
      .custom(async (name) => {
        const result =
          await sql`SELECT id FROM product_categories WHERE name = ${name}`;
        if (result.length > 0) throw new Error("Category name already exists");
      }),

    body("slug")
      .optional()
      .isSlug()
      .withMessage("Slug must be URL-friendly")
      .custom(async (slug) => {
        const result =
          await sql`SELECT id FROM product_categories WHERE slug = ${slug}`;
        if (result.length > 0) throw new Error("Category slug already exists");
      }),

    body("parent_id")
      .optional()
      .isUUID()
      .withMessage("Invalid parent ID format")
      .custom(async (parent_id) => {
        if (!parent_id) return;
        const result =
          await sql`SELECT id FROM product_categories WHERE id = ${parent_id}`;
        if (result.length === 0)
          throw new Error("Parent category does not exist");
      }),
  ],
  ALLOWED_CREATE_CATEGORY_FIELDS
);

export const validateUpdateCategory = withValidationErrors(
  [
    body("name")
      .optional()
      .isString()
      .withMessage("Invalid category name")
      .custom(async (name, { req }) => {
        if (!name) return;
        const categoryId = req.params?.id ?? null;

        const result =
          await sql`SELECT id FROM product_categories WHERE name = ${name}`;
        const row = result[0];

        if (row && row.id !== categoryId) {
          throw new Error("Category name already in use by another category");
        }
      }),

    body("slug")
      .optional()
      .isSlug()
      .withMessage("Slug must be URL-friendly")
      .custom(async (slug, { req }) => {
        const categoryId = req.params?.id ?? null;

        const result =
          await sql`SELECT id FROM product_categories WHERE slug = ${slug}`;
        const row = result[0];

        if (row && row.id !== categoryId) {
          throw new Error("Slug already in use by another category");
        }
      }),

    body("parent_id")
      .optional()
      .isUUID()
      .withMessage("Invalid parent ID format")
      .custom(async (parent_id, { req }) => {
        if (!parent_id) return;

        const categoryId = req.params?.id;

        if (parent_id === categoryId)
          throw new Error("A category cannot be its own parent");

        const result =
          await sql`SELECT id FROM product_categories WHERE id = ${parent_id}`;
        if (result.length === 0)
          throw new Error("Parent category does not exist");
      }),
  ],
  ALLOWED_UPDATE_CATEGORY_FIELDS
);
