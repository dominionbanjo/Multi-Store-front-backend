import express from "express";
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  verifyOtp,
  resendOtp,
} from "../controllers/authController.js";
import {
  validateRegisterInput,
  validateLoginInput,
  validateForgotPassword,
  validateResetPassword,
  validateOtpVerification,
  validateResendOtpVerification,
} from "../utils/validations/index.js";

const router = express.Router();

router.post("/register", validateRegisterInput, register);
router.post("/login", validateLoginInput, login);
router.post("/forgot-password", validateForgotPassword, forgotPassword);
router.post("/reset-password", validateResetPassword, resetPassword);
router.post("/verify-otp", validateOtpVerification, verifyOtp);
router.post("/resend-otp", validateResendOtpVerification, resendOtp);

export default router;
