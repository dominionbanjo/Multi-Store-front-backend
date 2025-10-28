import { body } from "express-validator";
import { withValidationErrors } from "../../middlewares/withValidationErrors.js";
import sql from "../../config/connect.js";

export const validateCreateStoreInput = withValidationErrors([
  body("store_name")
    .notEmpty()
    .withMessage("Store name is required")
    .custom(async (store_name) => {
      const result =
        await sql`SELECT * FROM stores WHERE store_name = ${store_name}`;
      if (result.length > 0) throw new Error("Store name already exists");
    }),
  body("username")
    .notEmpty()
    .withMessage("Store username is required")
    .custom(async (username) => {
      const result =
        await sql`SELECT * FROM stores WHERE username = ${username}`;
      if (result.length > 0) throw new Error("Store username already exists");
    }),
  body("description")
    .optional()
    .isString()
    .withMessage("Invalid description format"),
  body("category").optional().isString().withMessage("Invalid category"),
]);

export const validateUpdateStoreInput = withValidationErrors([
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
  body("username")
    .optional()
    .custom(async (username, { req }) => {
      const result =
        await sql`SELECT * FROM stores WHERE username = ${username}`;
      const store = result[0];
      if (store && store.user_id !== req.user.userId) {
        throw new Error("Store username already in use");
      }
    }),
  body("description").optional().isString(),
  body("category").optional().isString(),
]);
