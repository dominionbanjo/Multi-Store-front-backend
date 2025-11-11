import express from "express";
import {
  createOrder,
  getOrder,
  getUserOrders,
  updateOrderStatus,
  cancelOrder,
  createPaystackOrder,
  verifyPaystackOrder,
  verifyBankAccountController,
} from "../controllers/orderController.js";
import {
  authenticateUser,
  authorizePermissions,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * 🧾 ORDER ROUTES OVERVIEW
 *
 * POST   /api/v1/orders                       → Create order (manual / cash / escrow)
 * GET    /api/v1/orders                       → Get all orders for logged-in user
 * GET    /api/v1/orders/:id                   → Get a single order (buyer/vendor/admin)
 * PATCH  /api/v1/orders/:id/status            → Update order status (admin/vendor)
 * DELETE /api/v1/orders/:id                   → Cancel an order
 *
 * POST   /api/v1/orders/paystack/initialize   → Create order and init Paystack payment
 * GET    /api/v1/orders/paystack/verify       → Verify Paystack payment callback
 */

// ───────────────────────────────────────────────
// 🔒 Require Authentication for All Routes
// ───────────────────────────────────────────────
router.use(authenticateUser);

// ───────────────────────────────────────────────
// 📦 Core Order Routes
// ───────────────────────────────────────────────

// ➕ Create new order (without Paystack)
router.post("/", createOrder);

// 🧾 Get all orders for current user
router.get("/", getUserOrders);

// 📄 Get one order by ID
router.get("/:id", getOrder);

// 🔄 Update order status (vendor/admin only)
router.patch(
  "/:id/status",
  authorizePermissions("admin", "vendor"),
  updateOrderStatus
);

// ❌ Cancel an order
router.delete("/:id", cancelOrder);

// ───────────────────────────────────────────────
// 💳 Paystack Integration Routes
// ───────────────────────────────────────────────

// ➕ Create order + initialize Paystack
router.post("/paystack/initialize", createPaystackOrder);

// ✅ Verify Paystack payment
router.get("/paystack/verify", verifyPaystackOrder);

// 🔹 Bank verification (for frontend use)
router.post("/paystack/verify-bank", verifyBankAccountController);

export default router;
