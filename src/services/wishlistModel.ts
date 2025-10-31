import sql from "../config/connect.js";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";
import { v4 as uuidv4 } from "uuid";

class Wishlist {
  /** 🧾 Get the user's wishlist (only 1 product max) */
  static async getWishlist(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");

    const result = await sql`
      SELECT 
        id,
        user_id,
        product_id,
        name,
        image,
        price,
        stock,
        created_at,
        updated_at
      FROM wishlist
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    return result[0] || null;
  }

  /** ➕ Add product to wishlist — replaces existing one */
  static async addToWishlist(userId: string, product: any) {
    if (!userId) throw new BadRequestError("User ID is required");
    if (!product || !product.product_id)
      throw new BadRequestError("Product ID is required");

    const id = uuidv4();
    const { product_id, name, image, price, stock } = product;

    // Delete any existing wishlist for this user (only one allowed)
    await sql`DELETE FROM wishlist WHERE user_id = ${userId}`;

    // Insert new
    await sql`
      INSERT INTO wishlist (id, user_id, product_id, name, image, price, stock)
      VALUES (${id}, ${userId}, ${product_id}, ${name}, ${image}, ${price}, ${stock})
    `;

    const [newWishlist] = await sql`
      SELECT * FROM wishlist WHERE user_id = ${userId}
    `;

    return newWishlist;
  }

  /** 🗑️ Remove item from wishlist */
  static async removeFromWishlist(userId: string, productId: string) {
    if (!userId) throw new BadRequestError("User ID is required");
    if (!productId) throw new BadRequestError("Product ID is required");

    const result = await sql`
      DELETE FROM wishlist
      WHERE user_id = ${userId} AND product_id = ${productId}
      RETURNING *
    `;

    if (result.length === 0)
      throw new NotFoundError("Product not found in wishlist");

    return { success: true };
  }

  /** ❌ Clear entire wishlist */
  static async clearWishlist(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");
    await sql`DELETE FROM wishlist WHERE user_id = ${userId}`;
    return [];
  }
}

export default Wishlist;
