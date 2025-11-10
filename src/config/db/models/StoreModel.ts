// src/models/StoreModel.ts
import { BaseModel, SchemaDefinition } from "../helpers/BaseModel.js";

export interface IStore {
  id: string;
  user_id: string;
  store_name: string;
  username: string;
  description: string | null;
  logo: string | null;
  cover_image: string | null;
  rating_average: number | null;
  rating_count: number | null;
  category_ids: string[] | null; // array of linked product category IDs
  created_at: string | null;
  updated_at: string | null;
}

/**
 * 🏪 Store Model
 * - Belongs to a user (store owner)
 * - Can be linked to multiple product categories
 * - Stores can have products via `products.store_id`
 * - Indexed for `user_id` and `username`
 */
class StoreModelClass extends BaseModel<IStore> {
  protected table = "stores";

  // ✅ Type-safe schema – keys must match IStore exactly
  protected schema: SchemaDefinition<IStore> = {
    id: { type: "UUID", primaryKey: true },

    // 🔗 Linked to user (owner)
    user_id: {
      type: "UUID",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      index: true,
    },

    store_name: { type: "VARCHAR(255)", notNull: true },

    username: {
      type: "VARCHAR(100)",
      unique: true,
      notNull: true,
      index: true,
    },

    description: { type: "TEXT" },
    logo: { type: "TEXT" },
    cover_image: { type: "TEXT" },

    // ⭐ Rating summary
    rating_average: { type: "NUMERIC(3,2)", default: "0" },
    rating_count: { type: "INT", default: "0" },

    // 🏷️ Product category linkage (array of category IDs)
    category_ids: { type: "TEXT[]" },

    // 🕓 timestamps
    created_at: { type: "TIMESTAMP", default: "NOW()" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
  };
}

export const StoreModel = new StoreModelClass();
