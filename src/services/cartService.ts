import { CartModel, ICart } from "../config/db/models/CartModel.js";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";
import { v4 as uuidv4 } from "uuid";

/**
 * 🛒 CartService
 * Handles cart operations: add, update, remove, clear, and get summary.
 */
class CartService {
  /** 🧾 Get all cart items for a user (ordered by created_at DESC) */
  static async getUserCart(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");

    const { data } = await CartModel.findAll({ user_id: userId });
    return data.sort(
      (a, b) =>
        new Date(b.created_at ?? "").getTime() -
        new Date(a.created_at ?? "").getTime()
    );
  }

  /** ➕ Add or merge new items into the cart */
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

  /** 🔼 Increment quantity of an item */
  static async incrementItem(userId: string, productId: string, step = 1) {
    const existing = await CartModel.findOne({
      user_id: userId,
      product_id: productId,
    });
    if (!existing) throw new NotFoundError("Item not found in cart");

    const updated = await CartModel.update(existing.id, {
      quantity: existing.quantity + step,
      updated_at: new Date().toISOString(),
    });

    return updated;
  }

  /** 🔽 Decrement quantity of an item (or remove if zero) */
  static async decrementItem(userId: string, productId: string, step = 1) {
    const existing = await CartModel.findOne({
      user_id: userId,
      product_id: productId,
    });
    if (!existing) throw new NotFoundError("Item not found in cart");

    const newQty = existing.quantity - step;
    if (newQty <= 0) {
      await CartModel.delete(existing.id);
      return { success: true, message: "Item removed from cart" };
    }

    const updated = await CartModel.update(existing.id, {
      quantity: newQty,
      updated_at: new Date().toISOString(),
    });

    return updated;
  }

  /** 🔄 Update item quantity directly */
  static async updateItem(userId: string, itemId: string, quantity: number) {
    if (!userId || !itemId)
      throw new BadRequestError("User ID and item ID are required");
    if (quantity < 1) throw new BadRequestError("Quantity must be at least 1");

    const item = await CartModel.findOne({ id: itemId, user_id: userId });
    if (!item) throw new NotFoundError("Cart item not found");

    const updated = await CartModel.update(item.id, {
      quantity,
      updated_at: new Date().toISOString(),
    });

    return updated;
  }

  /** ❌ Remove specific item by ID */
  static async removeItem(userId: string, itemId: string) {
    if (!userId || !itemId)
      throw new BadRequestError("User ID and item ID are required");

    const existing = await CartModel.findOne({ id: itemId, user_id: userId });
    if (!existing) throw new NotFoundError("Item not found in cart");

    await CartModel.delete(itemId);
    return { success: true, message: "Item removed successfully" };
  }

  /** ❌ Remove item by product_id */
  static async removeByProductId(userId: string, productId: string) {
    if (!userId || !productId)
      throw new BadRequestError("User ID and product ID are required");

    const existing = await CartModel.findOne({
      user_id: userId,
      product_id: productId,
    });
    if (!existing) throw new NotFoundError("Item not found in cart");

    await CartModel.delete(existing.id);
    return { success: true, message: "Product removed successfully" };
  }

  /** 🧹 Clear entire cart for a user */
  static async clearCart(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");

    const result = await CartModel.deleteWhere({ user_id: userId });
    return {
      success: true,
      message: `Cart cleared successfully (${result.count} item${
        result.count !== 1 ? "s" : ""
      } removed)`,
    };
  }

  /** 📊 Get cart summary (total items + subtotal) */
  static async getSummary(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");

    const { data } = await CartModel.findAll({ user_id: userId });
    if (data.length === 0) return { itemCount: 0, subtotal: 0, items: [] };

    const subtotal = data.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0
    );
    const itemCount = data.reduce((sum, item) => sum + item.quantity, 0);

    return { itemCount, subtotal, items: data };
  }
}

export default CartService;
