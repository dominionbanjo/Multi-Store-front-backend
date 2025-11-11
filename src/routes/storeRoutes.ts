import express from "express";
import {
  createStore,
  getStore,
  getAllStores,
  getStoreProducts,
  updateStore,
  deleteStore,
  registerBankAccount,
  updateBankAccount,
  deleteBankAccount,
} from "../controllers/storeController.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ───────────────────────────────────────────────
// 🌍 Public routes
// ───────────────────────────────────────────────
router.get("/", getAllStores);
router.get("/:idOrUsername", getStore);
router.get("/:store_id/products", getStoreProducts);

// ───────────────────────────────────────────────
// 🔒 Protected routes (vendor only)
// ───────────────────────────────────────────────
router.post("/", authenticateUser, createStore);
router.patch("/:id", authenticateUser, updateStore);
router.delete("/:id", authenticateUser, deleteStore);

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
