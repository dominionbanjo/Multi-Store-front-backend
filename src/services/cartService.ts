import { CartModel, ICart, ICartItem } from "../config/db/models/CartModel.js";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";
import { v4 as uuidv4 } from "uuid";

class CartService {
  // Normalize NULL, undefined, and trim strings
  private static normalize(val: any) {
    if (val === undefined || val === null) return null;
    if (typeof val === "string") return val.trim().toLowerCase();
    return val;
  }

  // Create unique signature for item
  private static signature(item: ICartItem) {
    return [
      item.product_id,
      this.normalize(item.color),
      this.normalize(item.size),
    ].join("|");
  }

  // Remove duplicates: merge quantities of identical items
  private static mergeDuplicateItems(items: ICartItem[]) {
    const map = new Map<string, ICartItem>();

    for (const item of items) {
      const key = this.signature(item);

      if (!map.has(key)) {
        map.set(key, { ...item });
      } else {
        const existing = map.get(key)!;
        existing.quantity += item.quantity;
      }
    }

    return Array.from(map.values());
  }

  // ───────────────────────────────────────────────
  // Get or create user cart
  // ───────────────────────────────────────────────
  private static async getOrCreateCart(userId: string): Promise<ICart> {
    const cart = await CartModel.findOne({ user_id: userId });
    if (cart) return cart;

    return await CartModel.create({
      id: uuidv4(),
      user_id: userId,
      cart_items: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // ───────────────────────────────────────────────
  // Get cart
  // ───────────────────────────────────────────────
  static async getUserCart(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");
    return await this.getOrCreateCart(userId);
  }

  // ───────────────────────────────────────────────
  // Add items — NO duplicates allowed
  // ───────────────────────────────────────────────
  static async addItems(userId: string, items: ICartItem[]) {
    if (!userId) throw new BadRequestError("User ID is required");
    if (!Array.isArray(items) || items.length === 0)
      throw new BadRequestError("Cart items are required");

    const cart = await this.getOrCreateCart(userId);

    const updated = this.mergeDuplicateItems([...cart.cart_items, ...items]);

    return await CartModel.update(cart.id, {
      cart_items: updated,
      updated_at: new Date().toISOString(),
    });
  }

  // ───────────────────────────────────────────────
  // Replace entire cart (no duplicates)
  // ───────────────────────────────────────────────
  static async setCartItems(userId: string, items: ICartItem[]) {
    if (!Array.isArray(items))
      throw new BadRequestError("items must be an array");

    const cleaned = this.mergeDuplicateItems(items);

    const cart = await this.getOrCreateCart(userId);

    return await CartModel.update(cart.id, {
      cart_items: cleaned,
      updated_at: new Date().toISOString(),
    });
  }

  // ───────────────────────────────────────────────
  // Clear cart
  // ───────────────────────────────────────────────
  static async clearCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    return await CartModel.update(cart.id, {
      cart_items: [],
      updated_at: new Date().toISOString(),
    });
  }

  // ───────────────────────────────────────────────
  // Summary
  // ───────────────────────────────────────────────
  static async getSummary(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    if (cart.cart_items.length === 0)
      return { itemCount: 0, subtotal: 0, items: [] };

    const subtotal = cart.cart_items.reduce((sum, item) => {
      const price = item.discount_price ?? item.price;
      return sum + price * item.quantity;
    }, 0);

    const itemCount = cart.cart_items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    return {
      itemCount,
      subtotal,
      items: cart.cart_items,
    };
  }
}

export default CartService;
