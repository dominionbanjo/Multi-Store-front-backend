import { BaseModel, SchemaDefinition } from "../helpers/BaseModel.js";

export type TransactionType =
  | "payment" // buyer → platform
  | "escrow_hold" // platform holds funds
  | "payout" // platform → vendor
  | "refund" // platform → buyer
  | "fee" // commission
  | "offline_payment" // NEW — vendor logs manual payment
  | "order_created" // NEW — track offline order creation
  | "payment_offline"
  | "payment_init"
  | "payment_confirmed"
  | "order_canceled";

export type TransactionStatus = "pending" | "success" | "failed" | "reversed";

export interface ITransaction {
  id: string;
  order_id: string | null;
  escrow_id: string | null;
  user_id: string | null;
  vendor_id: string | null;
  store_id: string | null;

  type: TransactionType;
  amount: number;
  currency: string | null;
  reference: string | null;
  description: string | null;

  status: TransactionStatus;
  metadata: any | null;

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
