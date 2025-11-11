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
 * - Validates stock, price, and quantity
 * - Cascades on user/product deletion (auto cleanup)
 * - Indexed for fast lookups by user_id and product_id
 */
class CartModelClass extends BaseModel<ICart> {
  protected table = "cart";

  protected schema: SchemaDefinition<ICart> = {
    id: { type: "UUID", primaryKey: true },

    // 🧩 Relationship → users
    user_id: {
      type: "UUID",
      notNull: true,
      notNullMessage: "User ID is required",
      references: "users(id)",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      index: true,
    },

    // 🧩 Relationship → products
    product_id: {
      type: "UUID",
      notNull: true,
      notNullMessage: "Product ID is required",
      references: "products(id)",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      index: true,
    },

    name: {
      type: "VARCHAR(255)",
      notNull: true,
      notNullMessage: "Product name is required",
    },

    price: {
      type: "NUMERIC(10,2)",
      notNull: true,
      notNullMessage: "Product price is required",
      min: 0.01,
    },

    image: { type: "TEXT" },

    quantity: {
      type: "INT",
      default: "1",
      notNull: true,
      notNullMessage: "Quantity is required",
      min: 1,
      max: 1000,
    },

    stock: {
      type: "INT",
      default: "0",
      notNull: true,
      min: 0,
      max: 100000,
    },

    created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
    updated_at: { type: "TIMESTAMPTZ", default: "NOW()" },
  };
}

export const CartModel = new CartModelClass();
