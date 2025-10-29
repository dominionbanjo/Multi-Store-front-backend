import express from "express";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
} from "../controllers/wishlistController.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authenticateUser);

router.route("/").get(getWishlist).post(addToWishlist).delete(clearWishlist);

router.route("/:productId").delete(removeFromWishlist);

export default router;
