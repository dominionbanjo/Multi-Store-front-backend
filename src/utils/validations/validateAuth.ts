import { body } from "express-validator";
import { withValidationErrors } from "../../middlewares/withValidationErrors.js";

export const validateRegisterInput = withValidationErrors([
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
]);

export const validateLoginInput = withValidationErrors([
  body("email").notEmpty().isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
]);

export const validateForgotPassword = withValidationErrors([
  body("email").notEmpty().isEmail().withMessage("Valid email is required"),
]);

export const validateResetPassword = withValidationErrors([
  body("email").notEmpty().isEmail().withMessage("Valid email is required"),
  body("token").notEmpty().withMessage("Reset token is required"),
  body("password")
    .notEmpty()
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long"),
]);

export const validateOtpVerification = withValidationErrors([
  body("email").notEmpty().isEmail().withMessage("Valid email is required"),
  body("otp")
    .notEmpty()
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be a 6-digit code"),
]);

export const validateResendOtpVerification = withValidationErrors([
  body("email").notEmpty().isEmail().withMessage("Valid email is required"),
]);
