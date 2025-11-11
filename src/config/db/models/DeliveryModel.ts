import { BaseModel, SchemaDefinition } from "../helpers/BaseModel.js";

export type DeliveryStatus =
  | "pending"
  | "assigned"
  | "in_transit"
  | "delivered"
  | "confirmed"
  | "failed"
  | "returned";

export interface IDelivery {
  id: string;
  order_id: string | null;
  courier_id: string | null;
  buyer_id: string;
  vendor_id: string;

  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;

  tracking_number: string | null;
  delivery_status: DeliveryStatus;
  confirmation_code: string | null; // code used to mark delivery done
  proof_of_delivery_url: string | null;

  estimated_delivery: string | null;
  delivered_at: string | null;

  created_at: string | null;
  updated_at: string | null;
}

class DeliveryModelClass extends BaseModel<IDelivery> {
  protected table = "deliveries";

  protected schema: SchemaDefinition<IDelivery> = {
    id: { type: "UUID", primaryKey: true },

    order_id: {
      type: "UUID",
      references: "orders(id)",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },

    courier_id: {
      type: "UUID",
      references: "users(id)",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },

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

    // ⬇️ Made address/location fields nullable
    address: { type: "TEXT" },
    city: { type: "VARCHAR(100)" },
    state: { type: "VARCHAR(100)" },
    country: { type: "VARCHAR(100)" },
    postal_code: { type: "VARCHAR(20)" },

    tracking_number: { type: "VARCHAR(100)" },

    delivery_status: {
      type: "VARCHAR(50)",
      notNull: true,
      default: "'pending'",
      index: true,
    },

    confirmation_code: { type: "VARCHAR(20)" },
    proof_of_delivery_url: { type: "TEXT" },

    estimated_delivery: { type: "TIMESTAMPTZ" },
    delivered_at: { type: "TIMESTAMPTZ" },

    created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
    updated_at: { type: "TIMESTAMPTZ", default: "NOW()" },
  };
}

export const DeliveryModel = new DeliveryModelClass();
