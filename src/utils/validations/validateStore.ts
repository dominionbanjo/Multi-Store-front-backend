import { body } from "express-validator";
import { withValidationErrors } from "../../middlewares/withValidationErrors.js";
import sql from "../../config/connect.js";

// ✅ Allowed keys for strict checking
const ALLOWED_CREATE_FIELDS = [
  "store_name",
  "category",
  "description",
  "email",
  "phone_number",
  "address",
];

const ALLOWED_UPDATE_FIELDS = [
  "store_name",
  "category",
  "description",
  "email",
  "phone_number",
  "address",
];

// ───────────────────────────────────────────────
// 🏪 CREATE STORE VALIDATION
// ───────────────────────────────────────────────
export const validateCreateStoreInput = withValidationErrors(
  [
    body("store_name")
      .notEmpty()
      .withMessage("Store name is required")
      .custom(async (store_name) => {
        const result =
          await sql`SELECT * FROM stores WHERE store_name = ${store_name}`;
        if (result.length > 0) throw new Error("Store name already exists");
      }),
    body("category").optional().isString().withMessage("Invalid category"),

    body("description")
      .optional()
      .isString()
      .withMessage("Invalid description format"),

    body("email")
      .optional()
      .isEmail()
      .withMessage("Invalid email address format"),

    body("phone_number")
      .optional()
      .isString()
      .matches(/^[0-9+()\-\s]+$/)
      .withMessage("Invalid phone number format"),

    body("address")
      .optional()
      .isObject()
      .withMessage("Address must be an object with city/state/country"),
  ],
  ALLOWED_CREATE_FIELDS
);

// ───────────────────────────────────────────────
// 🧾 UPDATE STORE VALIDATION
// ───────────────────────────────────────────────
export const validateUpdateStoreInput = withValidationErrors(
  [
    body("store_name")
      .optional()
      .custom(async (store_name, { req }) => {
        const result =
          await sql`SELECT * FROM stores WHERE store_name = ${store_name}`;
        const store = result[0];
        if (store && store.user_id !== req.user.userId) {
          throw new Error("Store name already in use by another user");
        }
      }),

    body("category").optional().isString(),

    body("description").optional().isString(),

    body("email").optional().isEmail(),

    body("phone_number")
      .optional()
      .isString()
      .matches(/^[0-9+()\-\s]+$/)
      .withMessage("Invalid phone number format"),

    body("address")
      .optional()
      .isObject()
      .withMessage("Address must be an object with city/state/country"),
  ],
  ALLOWED_UPDATE_FIELDS
);
