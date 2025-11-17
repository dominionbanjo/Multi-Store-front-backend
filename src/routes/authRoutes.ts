import express from "express";
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  verifyOtp,
  resendOtp,
  logout,
} from "../controllers/authController.js";
import {
  validateRegisterInput,
  validateLoginInput,
  validateForgotPassword,
  validateResetPassword,
  validateOtpVerification,
  validateResendOtpVerification,
} from "../utils/validations/index.js";
import { continueWithGoogle } from "../controllers/googleAuthController.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/register", validateRegisterInput, register);
router.post("/login", validateLoginInput, login);
router.post("/forgot-password", validateForgotPassword, forgotPassword);
router.post("/reset-password", validateResetPassword, resetPassword);
router.post("/verify-otp", validateOtpVerification, verifyOtp);
router.post("/resend-otp", validateResendOtpVerification, resendOtp);
router.post("/google", continueWithGoogle);
router.post("/logout", authenticateUser, logout);

export default router;
