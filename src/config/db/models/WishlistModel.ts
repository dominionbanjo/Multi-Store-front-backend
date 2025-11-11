import { BaseModel, SchemaDefinition } from "../helpers/BaseModel.js";

export interface IWishlist {
  id: string;
  user_id: string;
  product_id: string;
  name: string;
  image: string | null;
  price: number;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * 💖 Wishlist Model
 * - Each user can have multiple products in their wishlist
 * - Linked to both `users(id)` and `products(id)`
 * - Auto-deletes if user or product is deleted
 * - Indexed for fast lookups
 */
class WishlistModelClass extends BaseModel<IWishlist> {
  protected table = "wishlist";

  protected schema: SchemaDefinition<IWishlist> = {
    id: { type: "UUID", primaryKey: true },

    // 🔗 Linked to user
    user_id: {
      type: "UUID",
      notNull: true,
      notNullMessage: "User ID is required",
      references: "users(id)",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      index: true,
    },

    // 🔗 Linked to product
    product_id: {
      type: "UUID",
      notNull: true,
      notNullMessage: "Product ID is required",
      references: "products(id)",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      index: true,
    },

    // 🏷️ Basic product info for snapshot storage
    name: {
      type: "VARCHAR(255)",
      notNull: true,
      notNullMessage: "Product name is required",
    },

    image: { type: "TEXT" },

    price: {
      type: "NUMERIC(10,2)",
      notNull: true,
      notNullMessage: "Product price is required",
    },

    // 🕓 Timestamps
    created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
    updated_at: { type: "TIMESTAMPTZ", default: "NOW()" },
  };
}

export const WishlistModel = new WishlistModelClass();
