import express from "express";
import {
  getCurrentUser,
  updateUser,
  getUserStores,
  updateUserStore,
} from "../controllers/userController.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";
import upload from "../utils/images/multer.js";
import {
  validateUpdateUserInput,
  validateUpdateStoreInput,
} from "../utils/validations/index.js";

const router = express.Router();

router.get("/", authenticateUser, getCurrentUser);
router.patch(
  "/",
  authenticateUser,
  upload.single("avatar"),
  validateUpdateUserInput,
  updateUser
);
router.get("/stores", authenticateUser, getUserStores);
router.put(
  "/stores/:storeId",
  authenticateUser,
  validateUpdateStoreInput,
  updateUserStore
);

export default router;
