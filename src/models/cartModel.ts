import sql from "../config/connect.js";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  stock: number;
  created_at?: string;
  updated_at?: string;
}

class Cart {
  /** 🛒 Get all cart items for a user */
  static async getUserCart(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");

    const items = await sql<CartItem[]>`
      SELECT 
        c.id, c.user_id, c.product_id,
        c.name, c.price, c.image, c.quantity, c.stock,
        c.created_at, c.updated_at
      FROM cart c
      WHERE c.user_id = ${userId}
      ORDER BY c.created_at DESC
    `;

    return items;
  }

  /** ➕ Add or merge new items into cart */
  static async addItems(userId: string, items: CartItem[]) {
    if (!userId) throw new BadRequestError("User ID is required");
    if (!items || items.length === 0)
      throw new BadRequestError("Cart items are required");

    for (const item of items) {
      // Check if the product already exists in cart
      const [existing] = await sql`
        SELECT * FROM cart WHERE user_id = ${userId} AND product_id = ${item.product_id}
      `;

      if (existing) {
        await sql`
          UPDATE cart
          SET quantity = quantity + ${item.quantity}, updated_at = NOW()
          WHERE user_id = ${userId} AND product_id = ${item.product_id}
        `;
      } else {
        await sql`
          INSERT INTO cart (
            id, user_id, product_id, name, price, image, quantity, stock, created_at, updated_at
          )
          VALUES (
            gen_random_uuid(), ${userId}, ${item.product_id}, ${item.name},
            ${item.price}, ${item.image}, ${item.quantity}, ${item.stock}, NOW(), NOW()
          )
        `;
      }
    }

    return await this.getUserCart(userId);
  }

  /** 🔄 Update item quantity */
  static async updateItem(userId: string, itemId: string, quantity: number) {
    if (!userId || !itemId)
      throw new BadRequestError("User ID and item ID are required");

    const [existing] = await sql`
      SELECT * FROM cart WHERE id = ${itemId} AND user_id = ${userId}
    `;
    if (!existing) throw new NotFoundError("Cart item not found");

    await sql`
      UPDATE cart
      SET quantity = ${quantity}, updated_at = NOW()
      WHERE id = ${itemId} AND user_id = ${userId}
    `;

    const [updated] = await sql`
      SELECT * FROM cart WHERE id = ${itemId}
    `;
    return updated;
  }

  /** ❌ Remove specific item */
  static async removeItem(userId: string, itemId: string) {
    if (!userId || !itemId)
      throw new BadRequestError("User ID and item ID are required");

    await sql`
      DELETE FROM cart WHERE id = ${itemId} AND user_id = ${userId}
    `;
    return { success: true, message: "Item removed successfully" };
  }

  /** 🧹 Clear all cart items for a user */
  static async clearCart(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");

    await sql`DELETE FROM cart WHERE user_id = ${userId}`;
    return { success: true, message: "Cart cleared successfully" };
  }
}

export default Cart;
