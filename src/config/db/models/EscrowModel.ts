import { BaseModel, SchemaDefinition } from "../helpers/BaseModel.js";

export type EscrowStatus =
  | "pending"
  | "funded"
  | "delivered"
  | "released"
  | "disputed"
  | "refunded";

export interface IEscrow {
  id: string;
  order_id: string | null;
  buyer_id: string;
  vendor_id: string;

  amount: number;
  hold_until: string | null; // date until funds are held
  release_code: string | null; // unique 6-digit or random code
  status: EscrowStatus;

  released_at: string | null;
  refunded_at: string | null;

  created_at: string | null;
  updated_at: string | null;
}

class EscrowModelClass extends BaseModel<IEscrow> {
  protected table = "escrows";

  protected schema: SchemaDefinition<IEscrow> = {
    id: { type: "UUID", primaryKey: true },

    order_id: {
      type: "UUID",
      references: "orders(id)",
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

    amount: { type: "NUMERIC(12,2)", notNull: true },
    hold_until: { type: "TIMESTAMPTZ" },
    release_code: { type: "VARCHAR(20)" },
    status: {
      type: "VARCHAR(50)",
      notNull: true,
      default: "'pending'",
      index: true,
    },

    released_at: { type: "TIMESTAMPTZ" },
    refunded_at: { type: "TIMESTAMPTZ" },

    created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
    updated_at: { type: "TIMESTAMPTZ", default: "NOW()" },
  };
}

export const EscrowModel = new EscrowModelClass();
