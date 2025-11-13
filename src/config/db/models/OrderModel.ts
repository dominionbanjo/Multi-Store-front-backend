import { BaseModel, SchemaDefinition } from "../helpers/BaseModel.js";
import { ICartItem } from "./CartModel.js";

export type OrderStatus =
  | "pending"
  | "processing"
  | "paid"
  | "in_transit"
  | "delivered"
  | "completed"
  | "failed"
  | "canceled";

export interface IOrder {
  id: string;
  buyer_id: string;
  vendor_id: string;
  store_id: string | null;
  escrow_id: string | null;
  delivery_id: string | null;

  subtotal: number;
  shipping_fee: number;
  tax: number | null;
  total: number;

  payment_reference: string | null;
  payment_url: string | null;
  payment_status: string | null;

  status: OrderStatus;
  notes: string | null;

  order_items: ICartItem[];

  created_at: string | null;
  updated_at: string | null;
}

class OrderModelClass extends BaseModel<IOrder> {
  protected table = "orders";

  protected schema: SchemaDefinition<IOrder> = {
    id: { type: "UUID", primaryKey: true },

    buyer_id: {
      type: "UUID",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    vendor_id: {
      type: "UUID",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    store_id: {
      type: "UUID",
      references: "stores(id)",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },

    escrow_id: {
      type: "UUID",
      references: "escrows(id)",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },

    delivery_id: {
      type: "UUID",
      references: "deliveries(id)",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },

    subtotal: { type: "NUMERIC(10,2)", notNull: true },
    shipping_fee: { type: "NUMERIC(10,2)", default: "0" },
    tax: { type: "NUMERIC(10,2)" },
    total: { type: "NUMERIC(10,2)", notNull: true },

    payment_reference: { type: "VARCHAR(255)" },
    payment_url: { type: "TEXT" },
    payment_status: { type: "VARCHAR(50)" },

    status: {
      type: "VARCHAR(50)",
      notNull: true,
      default: "'pending'",
      index: true,
    },

    notes: { type: "TEXT" },
    order_items: {
      type: "JSONB",
      notNull: true,
      default: "'[]'::jsonb",
    },

    created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
    updated_at: { type: "TIMESTAMPTZ", default: "NOW()" },
  };
}

export const OrderModel = new OrderModelClass();
