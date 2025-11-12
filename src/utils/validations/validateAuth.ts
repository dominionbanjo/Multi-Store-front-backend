import { body } from "express-validator";
import { withValidationErrors } from "../../middlewares/withValidationErrors.js";

// ───────────────────────────────────────────────
// ✅ Allowed fields per request type
// ───────────────────────────────────────────────
const ALLOWED_REGISTER_FIELDS = [
  "first_name",
  "last_name",
  "email",
  "password",
  "phone_number",
  "account_type",
];

const ALLOWED_LOGIN_FIELDS = ["email", "password"];

const ALLOWED_FORGOT_PASSWORD_FIELDS = ["email"];

const ALLOWED_RESET_PASSWORD_FIELDS = ["email", "token", "password"];

const ALLOWED_OTP_VERIFICATION_FIELDS = ["email", "otp"];

const ALLOWED_RESEND_OTP_FIELDS = ["email"];

// ───────────────────────────────────────────────
// 🧾 REGISTER VALIDATION
// ───────────────────────────────────────────────
export const validateRegisterInput = withValidationErrors(
  [
    body("first_name").notEmpty().withMessage("First name is required"),
    body("last_name").notEmpty().withMessage("Last name is required"),

    body("email").notEmpty().isEmail().withMessage("Valid email is required"),

    body("password")
      .notEmpty()
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long"),

    body("phone_number").notEmpty().withMessage("Phone number is required"),

    body("account_type")
      .notEmpty()
      .isIn(["vendor", "user"])
      .withMessage("Account type must be either 'vendor' or 'user'"),
  ],
  ALLOWED_REGISTER_FIELDS
);

// ───────────────────────────────────────────────
// 🔐 LOGIN VALIDATION
// ───────────────────────────────────────────────
export const validateLoginInput = withValidationErrors(
  [
    body("email").notEmpty().isEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  ALLOWED_LOGIN_FIELDS
);

// ───────────────────────────────────────────────
// 🧠 FORGOT PASSWORD VALIDATION
// ───────────────────────────────────────────────
export const validateForgotPassword = withValidationErrors(
  [body("email").notEmpty().isEmail().withMessage("Valid email is required")],
  ALLOWED_FORGOT_PASSWORD_FIELDS
);

// ───────────────────────────────────────────────
// 🔑 RESET PASSWORD VALIDATION
// ───────────────────────────────────────────────
export const validateResetPassword = withValidationErrors(
  [
    body("email").notEmpty().isEmail().withMessage("Valid email is required"),
    body("token").notEmpty().withMessage("Reset token is required"),
    body("password")
      .notEmpty()
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long"),
  ],
  ALLOWED_RESET_PASSWORD_FIELDS
);

// ───────────────────────────────────────────────
// 🔢 VERIFY OTP VALIDATION
// ───────────────────────────────────────────────
export const validateOtpVerification = withValidationErrors(
  [
    body("email").notEmpty().isEmail().withMessage("Valid email is required"),
    body("otp")
      .notEmpty()
      .isLength({ min: 6, max: 6 })
      .withMessage("OTP must be a 6-digit code"),
  ],
  ALLOWED_OTP_VERIFICATION_FIELDS
);

// ───────────────────────────────────────────────
// 🔁 RESEND OTP VALIDATION
// ───────────────────────────────────────────────
export const validateResendOtpVerification = withValidationErrors(
  [body("email").notEmpty().isEmail().withMessage("Valid email is required")],
  ALLOWED_RESEND_OTP_FIELDS
);
