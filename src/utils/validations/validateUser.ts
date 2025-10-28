import { body } from "express-validator";
import { withValidationErrors } from "../../middlewares/withValidationErrors.js";
import sql from "../../config/connect.js";

export const validateUpdateUserInput = withValidationErrors([
  body("first_name").optional().isString().withMessage("Invalid first name"),

  body("last_name").optional().isString().withMessage("Invalid last name"),

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
    .withMessage("Username must be a string")
    .custom(async (username, { req }) => {
      const result =
        await sql`SELECT id FROM users WHERE username = ${username}`;
      const user = result[0];
      if (user && user.id !== req.user.userId) {
        throw new Error("Username already in use");
      }
    }),
]);
