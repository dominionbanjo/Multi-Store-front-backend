// src/models/CartModel.ts
import { BaseModel, SchemaDefinition } from "../helpers/BaseModel.js";

export interface ICart {
  id: string;
  user_id: string;
  product_id: string;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
  stock: number;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * 🛒 Cart Model
 * - Each cart item belongs to a `user` and a `product`
 * - Cascades on user/product deletion (auto cleanup)
 * - Indexed for fast lookups by user_id and product_id
 */
class CartModelClass extends BaseModel<ICart> {
  protected table = "cart";

  // ✅ Strongly typed schema — must match ICart exactly
  protected schema: SchemaDefinition<ICart> = {
    id: { type: "UUID", primaryKey: true },

    // 🧩 Relationship → users
    user_id: {
      type: "UUID",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      index: true,
    },

    // 🧩 Relationship → products
    product_id: {
      type: "UUID",
      notNull: true,
      references: "products(id)",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      index: true,
    },

    name: { type: "VARCHAR(255)", notNull: true },
    price: { type: "NUMERIC(10,2)", notNull: true },
    image: { type: "TEXT" },

    quantity: { type: "INT", default: "1", notNull: true },
    stock: { type: "INT", default: "0", notNull: true },

    // 🕓 timestamps
    created_at: { type: "TIMESTAMP", default: "NOW()" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
  };
}

export const CartModel = new CartModelClass();
