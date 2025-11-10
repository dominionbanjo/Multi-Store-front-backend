// src/models/WishlistModel.ts
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
 * - Auto-deletes if user or product is removed
 * - Indexed for fast lookups
 */
class WishlistModelClass extends BaseModel<IWishlist> {
  protected table = "wishlist";

  // ✅ Type-safe schema – matches IWishlist exactly
  protected schema: SchemaDefinition<IWishlist> = {
    id: { type: "UUID", primaryKey: true },

    // 🔗 Linked to user
    user_id: {
      type: "UUID",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      index: true,
    },

    // 🔗 Linked to product
    product_id: {
      type: "UUID",
      notNull: true,
      references: "products(id)",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      index: true,
    },

    name: { type: "VARCHAR(255)", notNull: true },
    image: { type: "TEXT" },
    price: { type: "NUMERIC(10,2)", notNull: true },

    // 🕓 timestamps
    created_at: { type: "TIMESTAMP", default: "NOW()" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
  };
}

export const WishlistModel = new WishlistModelClass();
