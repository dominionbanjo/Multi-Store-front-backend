import { BaseModel, SchemaDefinition } from "../helpers/BaseModel.js";

export interface ICartItem {
  product_id: string;
  name: string;
  slug: string;
  price: number;
  discount_price: number | null;
  image: string | null;
  quantity: number;
  size: string | null;
  color: string | null;
  shipping_cost: number | null;
}

export interface ICart {
  id: string;
  user_id: string;
  cart_items: ICartItem[];
  created_at: string | null;
  updated_at: string | null;
}

class CartModelClass extends BaseModel<ICart> {
  protected table = "cart";

  protected schema: SchemaDefinition<ICart> = {
    id: { type: "UUID", primaryKey: true },

    user_id: {
      type: "UUID",
      notNull: true,
      notNullMessage: "User ID is required",
      references: "users(id)",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      unique: true, // one cart per user
      index: true,
    },

    cart_items: {
      type: "JSONB",
      notNull: true,
      default: "'[]'::jsonb",
    },

    created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
    updated_at: { type: "TIMESTAMPTZ", default: "NOW()" },
  };
}

export const CartModel = new CartModelClass();
