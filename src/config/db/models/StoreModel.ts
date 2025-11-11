import { BaseModel, SchemaDefinition } from "../helpers/BaseModel.js";

// ────────────────────────────────────────────────
// Customer Record for Store
// ────────────────────────────────────────────────
export interface IStoreCustomer {
  id: string;
  name: string;
  email: string;
  phone_number: string | null;
  location: string | null;
  orders: number;
  spent: number;
  rating: number;
  last_order_date: string;
}

// ────────────────────────────────────────────────
// Store Analytics Interfaces (unchanged)
// ────────────────────────────────────────────────
export interface IMonthlySales {
  month: string;
  year: number;
  amount: number;
}

export interface IMonthlyOrders {
  month: string;
  year: number;
  count: number;
}

export interface IMonthlyCustomers {
  month: string;
  year: number;
  count: number;
  list: string[];
}

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

  /** 💳 Payout info */
  account_number: string | null;
  bank_code: string | null;
  bank_name: string | null;
  recipient_code: string | null;
  settlement_email: string | null;

  /** 📊 Analytics + Cached Customers */
  analytics: IAnalytics | null;
  customers: IStoreCustomer[] | null;

  created_at: string | null;
  updated_at: string | null;
}

class StoreModelClass extends BaseModel<IStore> {
  protected table = "stores";

  protected schema: SchemaDefinition<IStore> = {
    id: { type: "UUID", primaryKey: true },

    user_id: {
      type: "UUID",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      index: true,
    },

    store_name: { type: "VARCHAR(255)", notNull: true },
    username: {
      type: "VARCHAR(100)",
      notNull: true,
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

    /** 💳 Bank and payout fields */
    account_number: { type: "VARCHAR(20)" },
    bank_code: { type: "VARCHAR(10)" },
    bank_name: { type: "VARCHAR(100)" },
    recipient_code: { type: "VARCHAR(100)" },
    settlement_email: { type: "VARCHAR(255)" },

    analytics: { type: "JSONB" },
    customers: { type: "JSONB" }, // ✅ Add customers JSON array

    created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
    updated_at: { type: "TIMESTAMPTZ", default: "NOW()" },
  };
}

export const StoreModel = new StoreModelClass();
