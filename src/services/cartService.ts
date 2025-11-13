import { CartModel, ICart, ICartItem } from "../config/db/models/CartModel.js";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";
import { v4 as uuidv4 } from "uuid";

class CartService {
  // ───────────────────────────────────────────────
  // 🧾 Get or create cart for user
  // ───────────────────────────────────────────────
  private static async getOrCreateCart(userId: string): Promise<ICart> {
    const cart = await CartModel.findOne({ user_id: userId });

    if (cart) return cart;

    // Create new empty cart
    return await CartModel.create({
      id: uuidv4(),
      user_id: userId,
      cart_items: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // ───────────────────────────────────────────────
  // 📦 Get full user cart
  // ───────────────────────────────────────────────
  static async getUserCart(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");

    return await this.getOrCreateCart(userId);
  }

  // ───────────────────────────────────────────────
  // ➕ Add / merge items
  // ───────────────────────────────────────────────
  static async addItems(userId: string, items: ICartItem[]) {
    if (!userId) throw new BadRequestError("User ID is required");
    if (!items || items.length === 0)
      throw new BadRequestError("Cart items are required");

    const cart = await this.getOrCreateCart(userId);

    const cartItems = [...cart.cart_items];

    for (const item of items) {
      const existing = cartItems.find(
        (c) =>
          c.product_id === item.product_id &&
          c.color === item.color &&
          c.size === item.size
      );

      if (existing) {
        existing.quantity += item.quantity;
      } else {
        cartItems.push(item);
      }
    }

    return await CartModel.update(cart.id, {
      cart_items: cartItems,
      updated_at: new Date().toISOString(),
    });
  }

  // ───────────────────────────────────────────────
  // 🔼 Increment quantity
  // ───────────────────────────────────────────────
  static async incrementItem(
    userId: string,
    productId: string,
    color: string | null,
    size: string | null,
    step = 1
  ) {
    const cart = await this.getOrCreateCart(userId);

    const item = cart.cart_items.find(
      (c) => c.product_id === productId && c.color === color && c.size === size
    );

    if (!item) throw new NotFoundError("Item not found in cart");

    item.quantity += step;

    return await CartModel.update(cart.id, {
      cart_items: cart.cart_items,
      updated_at: new Date().toISOString(),
    });
  }

  // ───────────────────────────────────────────────
  // 🔽 Decrement quantity
  // ───────────────────────────────────────────────
  static async decrementItem(
    userId: string,
    productId: string,
    color: string | null,
    size: string | null,
    step = 1
  ) {
    const cart = await this.getOrCreateCart(userId);

    const itemIndex = cart.cart_items.findIndex(
      (c) => c.product_id === productId && c.color === color && c.size === size
    );

    if (itemIndex === -1) throw new NotFoundError("Item not found in cart");

    const item = cart.cart_items[itemIndex];

    item.quantity -= step;

    if (item.quantity <= 0) {
      cart.cart_items.splice(itemIndex, 1);
    }

    return await CartModel.update(cart.id, {
      cart_items: cart.cart_items,
      updated_at: new Date().toISOString(),
    });
  }

  // ───────────────────────────────────────────────
  // 🔄 Update specific item quantity
  // ───────────────────────────────────────────────
  static async updateItem(
    userId: string,
    productId: string,
    color: string | null,
    size: string | null,
    quantity: number
  ) {
    if (quantity < 1) throw new BadRequestError("Quantity must be at least 1");

    const cart = await this.getOrCreateCart(userId);

    const item = cart.cart_items.find(
      (c) => c.product_id === productId && c.color === color && c.size === size
    );

    if (!item) throw new NotFoundError("Cart item not found");

    item.quantity = quantity;

    return await CartModel.update(cart.id, {
      cart_items: cart.cart_items,
      updated_at: new Date().toISOString(),
    });
  }

  // ───────────────────────────────────────────────
  // ❌ Remove item completely
  // ───────────────────────────────────────────────
  static async removeItem(
    userId: string,
    productId: string,
    color: string | null,
    size: string | null
  ) {
    const cart = await this.getOrCreateCart(userId);

    const newItems = cart.cart_items.filter(
      (c) =>
        !(c.product_id === productId && c.color === color && c.size === size)
    );

    return await CartModel.update(cart.id, {
      cart_items: newItems,
      updated_at: new Date().toISOString(),
    });
  }

  // ───────────────────────────────────────────────
  // 🧹 Clear entire cart
  // ───────────────────────────────────────────────
  static async clearCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    return await CartModel.update(cart.id, {
      cart_items: [],
      updated_at: new Date().toISOString(),
    });
  }

  // ───────────────────────────────────────────────
  // 📊 Summary
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
