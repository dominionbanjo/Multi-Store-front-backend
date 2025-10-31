import { CartModel, ICart } from "../config/db/models/CartModel.js";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";
import { v4 as uuidv4 } from "uuid";

class CartService {
  /** 🛒 Get all cart items for a user */
  static async getUserCart(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");
    const items = await CartModel.findAll({ user_id: userId });
    // mimic ORDER BY created_at DESC
    return items.sort(
      (a, b) =>
        new Date(b.created_at ?? "").getTime() -
        new Date(a.created_at ?? "").getTime()
    );
  }

  /** ➕ Add or merge new items into cart */
  static async addItems(userId: string, items: Omit<ICart, "id">[]) {
    if (!userId) throw new BadRequestError("User ID is required");
    if (!items || items.length === 0)
      throw new BadRequestError("Cart items are required");

    for (const item of items) {
      const existing = await CartModel.findOne({
        user_id: userId,
        product_id: item.product_id,
      });

      if (existing) {
        // Merge quantity if already in cart
        await CartModel.update(existing.id, {
          quantity: existing.quantity + item.quantity,
          updated_at: new Date().toISOString(),
        });
      } else {
        await CartModel.create({
          id: uuidv4(),
          user_id: userId,
          product_id: item.product_id,
          name: item.name,
          price: item.price,
          image: item.image ?? null,
          quantity: item.quantity,
          stock: item.stock,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }

    return await this.getUserCart(userId);
  }

  /** 🔄 Update item quantity */
  static async updateItem(userId: string, itemId: string, quantity: number) {
    if (!userId || !itemId)
      throw new BadRequestError("User ID and item ID are required");

    const item = await CartModel.findOne({ id: itemId, user_id: userId });
    if (!item) throw new NotFoundError("Cart item not found");

    const updated = await CartModel.update(item.id, {
      quantity,
      updated_at: new Date().toISOString(),
    });

    return updated;
  }

  /** ❌ Remove specific item */
  static async removeItem(userId: string, itemId: string) {
    if (!userId || !itemId)
      throw new BadRequestError("User ID and item ID are required");

    const existing = await CartModel.findOne({ id: itemId, user_id: userId });
    if (!existing) throw new NotFoundError("Item not found in cart");

    await CartModel.delete(itemId);
    return { success: true, message: "Item removed successfully" };
  }

  /** 🧹 Clear all cart items for a user */
  static async clearCart(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");

    const userItems = await CartModel.findAll({ user_id: userId });
    for (const item of userItems) {
      await CartModel.delete(item.id);
    }

    return { success: true, message: "Cart cleared successfully" };
  }
}

export default CartService;
