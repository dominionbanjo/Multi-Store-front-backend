import express from "express";
import {
  createDelivery,
  getDelivery,
  updateDeliveryStatus,
  assignCourier,
  confirmDelivery,
  uploadProof,
} from "../controllers/deliveryController.js";
import {
  authenticateUser,
  authorizePermissions,
} from "../middlewares/authMiddleware.js";
import upload from "../utils/images/multer.js";

const router = express.Router();

/**
 * DELIVERY ROUTES
 * Base path: /api/v1/deliveries
 */

// Require authentication for ALL delivery routes
router.use(authenticateUser);

router.post("/", authorizePermissions("admin"), createDelivery);
router.get("/:id", getDelivery);
router.patch("/:id/status", updateDeliveryStatus);
router.patch("/:id/assign", assignCourier);
router.patch("/confirm/:orderId", confirmDelivery);
router.patch("/:id/proof", upload.single("image"), uploadProof);

export default router;
