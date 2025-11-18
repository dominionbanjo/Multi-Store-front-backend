import express from "express";
import {
  createOrder,
  getOrder,
  getUserOrders,
  getVendorOrders,
  updateOrderStatus,
  cancelOrder,
  createPaystackOrder,
  verifyPaystackOrder,
  verifyBankAccountController,
  fulfillOfflineDeliveryController,
} from "../controllers/orderController.js";
import {
  authenticateUser,
  authorizePermissions,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * 🧾 ORDER ROUTES OVERVIEW
 *
 * OFFLINE ORDERS
 * POST   /api/v1/orders                           → Create offline order
 * PATCH  /api/v1/orders/:id/mark-paid-offline     → Mark offline order paid (vendor/admin)
 *
 * ONLINE ORDERS (PAYSTACK)
 * POST   /api/v1/orders/paystack/initialize       → Create + init Paystack payment
 * GET    /api/v1/orders/paystack/verify           → Verify Paystack payment
 *
 * GENERAL ORDER MANAGEMENT
 * GET    /api/v1/orders                           → Get logged in user orders
 * GET    /api/v1/orders/vendor                    → Get vendor’s orders
 * GET    /api/v1/orders/:id                       → Get single order
 * PATCH  /api/v1/orders/:id/status                → Update order status (vendor/admin)
 * DELETE /api/v1/orders/:id                       → Cancel order
 *
 * BANK VERIFICATION
 * POST   /api/v1/orders/paystack/verify-bank      → Verify bank account (frontend support)
 */

// ───────────────────────────────────────────────
// 🔒 Require Authentication for All Routes
// ───────────────────────────────────────────────
router.use(authenticateUser);

// ───────────────────────────────────────────────
// 📦 OFFLINE ORDER ROUTES
// ───────────────────────────────────────────────

// ➕ Create new OFFLINE order
router.post("/", createOrder);

// ✔ Mark an OFFLINE order as PAID manually
router.patch(
  "/:id/fulfill-offline",
  authenticateUser,
  authorizePermissions("vendor", "admin"),
  fulfillOfflineDeliveryController
);

// ───────────────────────────────────────────────
// 📦 GENERAL ORDER RETRIEVAL
// ───────────────────────────────────────────────

// 🧾 Get all logged-in buyer’s orders
router.get("/", getUserOrders);

// 🧾 Get vendor’s orders
router.get("/vendor", authorizePermissions("admin", "vendor"), getVendorOrders);

// 📄 Get one order by ID (buyer/vendor/admin)
router.get("/:id", getOrder);

// ───────────────────────────────────────────────
// 🔄 ORDER MANAGEMENT
// ───────────────────────────────────────────────

// Update status (vendor/admin only)
router.patch(
  "/:id/status",
  authorizePermissions("admin", "vendor"),
  updateOrderStatus
);

// ❌ Cancel an order
router.delete("/:id", cancelOrder);

// ───────────────────────────────────────────────
// 💳 ONLINE (PAYSTACK) PAYMENT ROUTES
// ───────────────────────────────────────────────

// Initialize Paystack payment
router.post("/paystack/initialize", createPaystackOrder);

// Verify Paystack callback
router.get(
  "/paystack/verify",
  authorizePermissions("admin"),
  verifyPaystackOrder
);

// Verify bank account (frontend helper)
router.post("/paystack/verify-bank", verifyBankAccountController);

export default router;
