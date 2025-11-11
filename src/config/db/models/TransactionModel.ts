import { BaseModel, SchemaDefinition } from "../helpers/BaseModel.js";

export type TransactionType =
  | "payment" // buyer → platform
  | "escrow_hold" // platform holds for vendor
  | "payout" // platform → vendor
  | "refund" // platform → buyer
  | "fee"; // platform commission or charge;

export type TransactionStatus = "pending" | "success" | "failed" | "reversed";

/**
 * Represents a single financial movement.
 * Can be linked to an order, escrow, vendor, or buyer.
 */
export interface ITransaction {
  id: string;
  order_id: string | null;
  escrow_id: string | null;
  user_id: string | null; // who initiated it
  vendor_id: string | null; // receiver (if payout)
  store_id: string | null; // vendor store (optional)
  type: TransactionType;
  amount: number;
  currency: string | null; // "NGN", "USD", etc
  reference: string | null; // Paystack reference or internal ref
  description: string | null;
  status: TransactionStatus;
  metadata: any | null; // JSONB to store full Paystack response or extra data
  created_at: string | null;
  updated_at: string | null;
}

class TransactionModelClass extends BaseModel<ITransaction> {
  protected table = "transactions";

  protected schema: SchemaDefinition<ITransaction> = {
    id: { type: "UUID", primaryKey: true },

    order_id: {
      type: "UUID",
      references: "orders(id)",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      index: true,
    },

    escrow_id: {
      type: "UUID",
      references: "escrows(id)",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      index: true,
    },

    user_id: {
      type: "UUID",
      references: "users(id)",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      index: true,
    },

    vendor_id: {
      type: "UUID",
      references: "users(id)",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      index: true,
    },

    store_id: {
      type: "UUID",
      references: "stores(id)",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      index: true,
    },

    type: { type: "VARCHAR(50)", notNull: true, index: true },
    amount: { type: "NUMERIC(12,2)", notNull: true },
    currency: { type: "VARCHAR(10)", default: "'NGN'" },
    reference: { type: "VARCHAR(255)" },
    description: { type: "TEXT" },

    status: {
      type: "VARCHAR(50)",
      notNull: true,
      default: "'pending'",
      index: true,
    },

    metadata: { type: "JSONB" },

    created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
    updated_at: { type: "TIMESTAMPTZ", default: "NOW()" },
  };
}

export const TransactionModel = new TransactionModelClass();
