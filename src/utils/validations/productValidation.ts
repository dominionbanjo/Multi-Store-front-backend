import { body } from "express-validator";
import { withValidationErrors } from "../../middlewares/withValidationErrors.js";
import sql from "../../config/connect.js";

// ───────────────────────────────────────────────
// ✅ Allowed fields per operation
// ───────────────────────────────────────────────
const ALLOWED_CREATE_PRODUCT_FIELDS = [
  "name",
  "category",
  "price",
  "discount_price",
  "stock",
  "description",
  "tags",
  "gallery",
  "highlights",
  "specs",
  "colors",
  "sizes",
  "shipping_note",
  "returns_note",
  "location",
  "shipping_cost",
];

const ALLOWED_UPDATE_PRODUCT_FIELDS = [
  "name",
  "slug",
  "price",
  "category",
  "discount_price",
  "stock",
  "description",
  "tags",
  "gallery",
  "highlights",
  "specs",
  "colors",
  "sizes",
  "shipping_note",
  "returns_note",
  "location",
  "shipping_cost",
];

const ALLOWED_ADD_REVIEW_FIELDS = ["rating", "comment", "product_id"];

// ───────────────────────────────────────────────
// 🧾 PRODUCT CREATE VALIDATION
// ───────────────────────────────────────────────
export const validateCreateProduct = withValidationErrors(
  [
    body("name").notEmpty().withMessage("Product name is required"),

    body("category").notEmpty().withMessage("Category is required").isString(),

    body("price").notEmpty(),

    body("discount_price").optional(),
    body("stock").optional(),
    body("tags").optional().isArray(),

    body("highlights").optional().isArray(),

    body("specs")
      .optional()
      .custom((value) => {
        if (typeof value === "string") {
          try {
            JSON.parse(value);
            return true;
          } catch {
            throw new Error("Specs must be valid JSON");
          }
        }
        if (typeof value === "object") return true;
        throw new Error("Specs must be a valid JSON object");
      }),

    body("colors").optional().isArray(),

    body("sizes").optional().isArray(),

    body("shipping_cost").optional(),
  ],
  ALLOWED_CREATE_PRODUCT_FIELDS
);

// ───────────────────────────────────────────────
// ✏️ PRODUCT UPDATE VALIDATION
// ───────────────────────────────────────────────
export const validateUpdateProduct = withValidationErrors(
  [
    body("name").optional().isString(),

    body("category").optional().isString(),

    body("price").optional(),

    body("discount_price").optional(),

    body("stock").optional().isInt({ min: 0 }),

    body("tags").optional().isArray(),

    body("highlights").optional().isArray(),

    body("specs")
      .optional()
      .custom((value) => {
        if (typeof value === "string") {
          try {
            JSON.parse(value);
            return true;
          } catch {
            throw new Error("Specs must be valid JSON");
          }
        }
        if (typeof value === "object") return true;
        throw new Error("Specs must be a JSON object");
      }),

    body("colors").optional().isArray(),

    body("sizes").optional().isArray(),

    body("shipping_cost").optional(),
  ],
  [
    "name",
    "category",
    "price",
    "discount_price",
    "stock",
    "description",
    "tags",
    "highlights",
    "specs",
    "colors",
    "sizes",
    "shipping_note",
    "returns_note",
    "location",
    "shipping_cost",
  ]
);

// ───────────────────────────────────────────────
// ⭐ ADD REVIEW VALIDATION
// ───────────────────────────────────────────────
export const validateAddReview = withValidationErrors(
  [
    body("rating")
      .notEmpty()
      .withMessage("Rating is required")
      .isInt({ min: 1, max: 5 })
      .withMessage("Rating must be between 1 and 5"),

    body("comment")
      .optional()
      .isString()
      .withMessage("Comment must be a string"),
  ],
  ALLOWED_ADD_REVIEW_FIELDS
);
