import { BaseModel, SchemaDefinition } from "../helpers/BaseModel.js";

// ────────────────────────────────────────────────
// 🧩 Define the shape of store analytics
// ────────────────────────────────────────────────

/** Monthly sales record */
export interface IMonthlySales {
  month: string; // "Jan" | "Feb" | ... | "Dec"
  year: number; // e.g. 2025
  amount: number; // total revenue for that month
}

/** Monthly orders record */
export interface IMonthlyOrders {
  month: string;
  year: number;
  count: number; // total orders placed
}

/** Monthly customers record */
export interface IMonthlyCustomers {
  month: string;
  year: number;
  count: number; // number of unique customers
  list: string[]; // customer IDs for uniqueness tracking
}

/** Aggregated analytics JSON structure */
export interface IAnalytics {
  sales: IMonthlySales[];
  orders: IMonthlyOrders[];
  customers: IMonthlyCustomers[];
}

// ────────────────────────────────────────────────
// 🏪 Store Interface
// ────────────────────────────────────────────────

export interface IStore {
  id: string;
  user_id: string;
  store_name: string;
  username: string;
  description: string | null;
  logo: string | null;
  cover_image: string | null;
  image: string | null;

  rating_average: number | null;
  rating_count: number | null;
  category_ids: string[] | null;

  total_revenue: number | null;
  total_orders: number | null;
  active_customers: number | null;
  products_listed: number | null;

  /** 📊 Structured analytics (JSONB) */
  analytics: IAnalytics | null;

  created_at: string | null;
  updated_at: string | null;
}

// ────────────────────────────────────────────────
// 🧱 Store Model Class
// ────────────────────────────────────────────────

class StoreModelClass extends BaseModel<IStore> {
  protected table = "stores";

  protected schema: SchemaDefinition<IStore> = {
    id: { type: "UUID", primaryKey: true },

    user_id: {
      type: "UUID",
      notNull: true,
      notNullMessage: "User ID is required",
      references: "users(id)",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      index: true,
    },

    store_name: {
      type: "VARCHAR(255)",
      notNull: true,
      notNullMessage: "Store name is required",
    },

    username: {
      type: "VARCHAR(100)",
      notNull: true,
      notNullMessage: "Store username is required",
      unique: true,
      index: true,
    },

    description: { type: "TEXT" },
    logo: { type: "TEXT" },
    cover_image: { type: "TEXT" },
    image: { type: "TEXT" },

    rating_average: { type: "NUMERIC(3,2)", default: "0" },
    rating_count: { type: "INT", default: "0" },
    category_ids: { type: "TEXT[]" },

    total_revenue: { type: "NUMERIC(12,2)", default: "0" },
    total_orders: { type: "INT", default: "0" },
    active_customers: { type: "INT", default: "0" },
    products_listed: { type: "INT", default: "0" },

    /** ✅ Analytics JSONB field to hold sales, orders, customers */
    analytics: { type: "JSONB" },

    created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
    updated_at: { type: "TIMESTAMPTZ", default: "NOW()" },
  };
}

export const StoreModel = new StoreModelClass();
