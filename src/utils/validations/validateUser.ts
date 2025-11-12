import { body } from "express-validator";
import { withValidationErrors } from "../../middlewares/withValidationErrors.js";
import sql from "../../config/connect.js";

// ✅ Strictly allowed fields
const ALLOWED_UPDATE_USER_FIELDS = [
  "first_name",
  "last_name",
  "email",
  "phone_number",
  "username",
  "current_sales_channel",
  "address",
];

export const validateUpdateUserInput = withValidationErrors(
  [
    body("first_name").optional().isString().trim().notEmpty(),

    body("last_name").optional().isString().trim().notEmpty(),

    body("email")
      .optional()
      .isEmail()
      .withMessage("Invalid email address")
      .custom(async (email, { req }) => {
        const result = await sql`SELECT id FROM users WHERE email = ${email}`;
        const user = result[0];
        if (user && user.id !== req.user.userId) {
          throw new Error("Email already in use");
        }
      }),

    body("phone_number")
      .optional()
      .isMobilePhone("any")
      .withMessage("Invalid phone number format"),

    body("username")
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .custom(async (username, { req }) => {
        const result =
          await sql`SELECT id FROM users WHERE username = ${username}`;
        const user = result[0];
        if (user && user.id !== req.user.userId) {
          throw new Error("Username already in use");
        }
      }),

    body("current_sales_channel")
      .optional()
      .isIn(["whatsapp", "instagram", "facebook", "tiktok", "other"])
      .withMessage("Invalid sales channel"),

    body("address")
      .optional()
      .custom((value) => {
        if (typeof value === "string") {
          try {
            JSON.parse(value);
          } catch {
            throw new Error("Invalid JSON format for address");
          }
        }
        return true;
      }),
  ],
  ALLOWED_UPDATE_USER_FIELDS // ✅ enforce strict input filtering
);
