import express from "express";
import {
  getCurrentUser,
  updateUser,
  getUserStores,
  getAllUsers,
  registerBankAccount,
  updateBankAccount,
  deleteBankAccount,
} from "../controllers/userController.js";

import {
  authenticateUser,
  authorizePermissions,
} from "../middlewares/authMiddleware.js";

import upload from "../utils/images/multer.js";
import { validateUpdateUserInput } from "../utils/validations/index.js";

const router = express.Router();

// 🧾 ADMIN: Get all users
router.get(
  "/all",
  authenticateUser,
  authorizePermissions("admin"),
  getAllUsers
);

// 👤 Current user
router.get("/", authenticateUser, getCurrentUser);

// ✏️ Update profile
router.patch(
  "/",
  authenticateUser,
  upload.single("avatar"),
  validateUpdateUserInput,
  updateUser
);

// 🏬 Get user stores
router.get("/stores", authenticateUser, getUserStores);

// 🏦 BANK ACCOUNT MANAGEMENT
router.post("/bank/register", authenticateUser, registerBankAccount);

router.patch("/bank/update", authenticateUser, updateBankAccount);

router.delete("/bank/delete", authenticateUser, deleteBankAccount);

export default router;
