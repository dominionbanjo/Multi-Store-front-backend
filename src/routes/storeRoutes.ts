import express from "express";
import {
  createStore,
  getStore,
  getAllStores,
  getStoreProducts,
  updateStore,
  deleteStore,
} from "../controllers/storeController.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public
router.get("/", getAllStores);
router.get("/:idOrUsername", getStore);
router.get("/:store_id/products", getStoreProducts);

// Protected (vendor only)
router.post("/", authenticateUser, createStore);
router.patch("/:id", authenticateUser, updateStore);
router.delete("/:id", authenticateUser, deleteStore);

export default router;
