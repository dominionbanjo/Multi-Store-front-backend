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
  getStoreAnalytics,
  checkStoreNameAvailability,
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

/* -----------------------------------------------
   🌍 PUBLIC ROUTES
------------------------------------------------ */
router.get("/", getAllStores);

// Check if store name exists
router.get("/check-name", checkStoreNameAvailability);

// Admin only — get all stores
router.get(
  "/admin",
  authenticateUser,
  authorizePermissions("admin"),
  getAllStoresAdmin
);

// Get store analytics (dashboard)
router.get(
  "/:store_id/analytics",
  authenticateUser,
  authorizePermissions("admin", "vendor"),
  getStoreAnalytics
);

// Get store by slug or ID
router.get("/:idOrSlug", getStore);

// Store products
router.get("/:idOrSlug/products", getStoreProducts);

/* -----------------------------------------------
   🔒 PROTECTED ROUTES (VENDOR)
------------------------------------------------ */
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

/* -----------------------------------------------
   💳 BANK ACCOUNT MANAGEMENT
------------------------------------------------ */
// Register Paystack bank account
router.post("/:id/bank", authenticateUser, registerBankAccount);

// Update bank account (re-verifies)
router.patch("/:id/bank", authenticateUser, updateBankAccount);

// Delete bank account
router.delete("/:id/bank", authenticateUser, deleteBankAccount);

export default router;
