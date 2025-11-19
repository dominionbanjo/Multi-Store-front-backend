import { CartModel, ICart, ICartItem } from "../config/db/models/CartModel.js";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";
import { v4 as uuidv4 } from "uuid";
import { ServiceCache } from "../utils/helpers/ServiceCache.js";

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
  // Get or create user cart  (CACHED)
  // ───────────────────────────────────────────────
  private static async getOrCreateCart(userId: string): Promise<ICart> {
    const key = ServiceCache.key("cart", "user", userId);

    const cached = await ServiceCache.get<ICart>(key);
    if (cached) return cached;

    let cart = await CartModel.findOne({ user_id: userId });

    if (!cart) {
      cart = await CartModel.create({
        id: uuidv4(),
        user_id: userId,
        cart_items: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    await ServiceCache.set(key, cart);
    return cart;
  }

  // ───────────────────────────────────────────────
  // Public getUserCart() wrapper (cached)
  // ───────────────────────────────────────────────
  static async getUserCart(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");
    return await this.getOrCreateCart(userId);
  }

  // ───────────────────────────────────────────────
  // Add items → INVALIDATE CACHE
  // ───────────────────────────────────────────────
  static async addItems(userId: string, items: ICartItem[]) {
    if (!userId) throw new BadRequestError("User ID is required");
    if (!Array.isArray(items) || items.length === 0)
      throw new BadRequestError("Cart items are required");

    const cart = await this.getOrCreateCart(userId);

    const updated = this.mergeDuplicateItems([...cart.cart_items, ...items]);

    const result = await CartModel.update(cart.id, {
      cart_items: updated,
      updated_at: new Date().toISOString(),
    });

    await ServiceCache.clear("svc:cart"); // full cart invalidation
    return result;
  }

  // ───────────────────────────────────────────────
  // Replace entire cart → INVALIDATE CACHE
  // ───────────────────────────────────────────────
  static async setCartItems(userId: string, items: ICartItem[]) {
    if (!Array.isArray(items))
      throw new BadRequestError("items must be an array");

    const cleaned = this.mergeDuplicateItems(items);
    const cart = await this.getOrCreateCart(userId);

    const result = await CartModel.update(cart.id, {
      cart_items: cleaned,
      updated_at: new Date().toISOString(),
    });

    await ServiceCache.clear("svc:cart");
    return result;
  }

  // ───────────────────────────────────────────────
  // Clear cart → INVALIDATE CACHE
  // ───────────────────────────────────────────────
  static async clearCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    const result = await CartModel.update(cart.id, {
      cart_items: [],
      updated_at: new Date().toISOString(),
    });

    await ServiceCache.clear("svc:cart");
    return result;
  }

  // ───────────────────────────────────────────────
  // Summary (CACHED)
  // ───────────────────────────────────────────────
  static async getSummary(userId: string) {
    const key = ServiceCache.key("cart", "summary", userId);

    const cached = await ServiceCache.get<{
      itemCount: number;
      subtotal: number;
      items: ICartItem[];
    }>(key);
    if (cached) return cached;

    const cart = await this.getOrCreateCart(userId);

    if (cart.cart_items.length === 0) {
      const response = { itemCount: 0, subtotal: 0, items: [] };
      await ServiceCache.set(key, response);
      return response;
    }

    const subtotal = cart.cart_items.reduce((sum, item) => {
      const price = item.discount_price ?? item.price;
      return sum + price * item.quantity;
    }, 0);

    const itemCount = cart.cart_items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    const response = { itemCount, subtotal, items: cart.cart_items };

    await ServiceCache.set(key, response);
    return response;
  }
}

export default CartService;
