import express from "express";
import {
  getCurrentUser,
  updateUser,
  getUserStores,
  getAllUsers,
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

router.get("/", authenticateUser, getCurrentUser);
router.patch(
  "/",
  authenticateUser,
  upload.single("avatar"),
  validateUpdateUserInput,
  updateUser
);
router.get("/stores", authenticateUser, getUserStores);

export default router;
