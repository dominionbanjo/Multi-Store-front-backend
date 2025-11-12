import express from "express";
import {
  createStore,
  getStore,
  getAllStores,
  getAllStoresAdmin,
  getStoreProducts,
  updateStore,
  deleteStore,
  registerBankAccount,
  updateBankAccount,
  deleteBankAccount,
} from "../controllers/storeController.js";
import {
  authenticateUser,
  authorizePermissions,
} from "../middlewares/authMiddleware.js";
import {
  validateCreateStoreInput,
  validateUpdateStoreInput,
} from "../utils/validations/validateStore.js";
import upload from "../utils/images/multer.js";

const router = express.Router();

// ───────────────────────────────────────────────
// 🌍 Public routes
// ───────────────────────────────────────────────
router.get("/", getAllStores);
router.get(
  "/admin",
  authenticateUser,
  authorizePermissions("admin"),
  getAllStoresAdmin
);
router.get("/:idOrSlug", getStore);
router.get("/:idOrSlug/products", getStoreProducts);

// ───────────────────────────────────────────────
// 🔒 Protected routes (vendor only)
// ───────────────────────────────────────────────
router.post("/", authenticateUser, validateCreateStoreInput, createStore);
router.patch(
  "/:id",
  authenticateUser,
  authorizePermissions("vendor"),
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "cover_image", maxCount: 1 },
  ]),
  validateUpdateStoreInput,
  updateStore
);
router.delete(
  "/:id",
  authenticateUser,
  authorizePermissions("vendor"),
  deleteStore
);

// ───────────────────────────────────────────────
// 💳 Bank Account Management
// ───────────────────────────────────────────────
// Register new bank account (Paystack recipient creation)
router.post("/:id/bank", authenticateUser, registerBankAccount);

// Update existing bank account info (non-recipient fields)
router.patch("/:id/bank", authenticateUser, updateBankAccount);

// Delete a store’s bank account info
router.delete("/:id/bank", authenticateUser, deleteBankAccount);

export default router;
