import { BaseModel, SchemaDefinition } from "../helpers/BaseModel.js";

export type PayoutStatus = "pending" | "success" | "failed" | "reversed";

export interface IPayout {
  id: string;
  order_id: string | null;
  escrow_id: string | null;
  transfer_code: string | null;
  transfer_reference: string | null;
  recipient_code: string | null;
  amount: number;
  currency: string | null;
  status: PayoutStatus;
  metadata: any | null;
  created_at: string | null;
  updated_at: string | null;
}

class PayoutModelClass extends BaseModel<IPayout> {
  protected table = "payouts";

  protected schema: SchemaDefinition<IPayout> = {
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
    transfer_code: { type: "VARCHAR(255)", index: true },
    transfer_reference: { type: "VARCHAR(255)" },
    recipient_code: { type: "VARCHAR(255)" },
    amount: { type: "NUMERIC(12,2)", notNull: true },
    currency: { type: "VARCHAR(10)", default: "'NGN'" },
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

export const PayoutModel = new PayoutModelClass();
