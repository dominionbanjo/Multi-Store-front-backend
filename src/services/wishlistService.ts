import { WishlistModel, IWishlist } from "../config/db/models/WishlistModel.js";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";
import { v4 as uuidv4 } from "uuid";

/**
 * 💖 Wishlist Service
 * Handles add, remove, list, and clear wishlist logic.
 */
class WishlistService {
  /** 🧾 Get all wishlist items for a user */
  static async getWishlist(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");

    const { data } = await WishlistModel.findAll({ user_id: userId });
    return data.sort(
      (a, b) =>
        new Date(b.created_at ?? "").getTime() -
        new Date(a.created_at ?? "").getTime()
    );
  }

  /** ➕ Add product to wishlist */
  static async addToWishlist(
    userId: string,
    product: {
      product_id: string;
      name: string;
      image?: string | null;
      price: number;
    }
  ) {
    if (!userId) throw new BadRequestError("User ID is required");
    if (!product?.product_id)
      throw new BadRequestError("Product ID is required");

    // Check if it already exists
    const existing = await WishlistModel.findOne({
      user_id: userId,
      product_id: product.product_id,
    });

    if (existing)
      return { message: "Product already in wishlist", item: existing };

    const newItem = await WishlistModel.create({
      id: uuidv4(),
      user_id: userId,
      product_id: product.product_id,
      name: product.name,
      image: product.image ?? null,
      price: product.price,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return newItem;
  }

  /** 🗑️ Remove product from wishlist */
  static async removeFromWishlist(userId: string, productId: string) {
    if (!userId) throw new BadRequestError("User ID is required");
    if (!productId) throw new BadRequestError("Product ID is required");

    const existing = await WishlistModel.findOne({
      user_id: userId,
      product_id: productId,
    });

    if (!existing) throw new NotFoundError("Product not found in wishlist");

    await WishlistModel.delete(existing.id);

    return { success: true, message: "Removed from wishlist" };
  }

  /** ❌ Clear entire wishlist for a user */
  static async clearWishlist(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");

    const result = await WishlistModel.deleteWhere({ user_id: userId });
    return {
      success: true,
      message: `Wishlist cleared (${result.count} item${
        result.count !== 1 ? "s" : ""
      } removed)`,
    };
  }
}

export default WishlistService;
