import { BaseModel, SchemaDefinition } from "../helpers/BaseModel.js";

/** 🏠 Nested Address Type (same as UserModel) */
export interface IStoreAddress {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
}

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
// Store Analytics Interfaces
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
  category: string | null; // ✅ new overall category
  description: string | null;
  logo: string | null;
  cover_image: string | null;
  image: string | null;

  /** 📞 Contact info */
  email: string | null;
  phone_number: string | null;
  website: string | null;

  rating_average: number | null;
  rating_count: number | null;
  category_ids: string[] | null;

  total_revenue: number | null;
  total_orders: number | null;
  total_products: number | null; // ✅ new cached count
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

  /** 🏠 Address (JSONB like UserModel) */
  address: IStoreAddress | null; // ✅ new field

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

    /** 🏷️ Category & Description */
    category: { type: "VARCHAR(100)" },
    description: { type: "TEXT" },

    /** 🖼️ Media */
    logo: { type: "TEXT" },
    cover_image: { type: "TEXT" },
    image: { type: "TEXT" },

    /** 📞 Contact */
    email: { type: "VARCHAR(255)" },
    phone_number: { type: "VARCHAR(20)" },
    website: { type: "VARCHAR(255)" },

    /** ⭐ Ratings */
    rating_average: { type: "NUMERIC(3,2)", default: "0" },
    rating_count: { type: "INT", default: "0" },

    /** 📚 Categories */
    category_ids: { type: "TEXT[]" },

    /** 📊 Stats */
    total_revenue: { type: "NUMERIC(12,2)", default: "0" },
    total_orders: { type: "INT", default: "0" },
    total_products: { type: "INT", default: "0" }, // ✅
    active_customers: { type: "INT", default: "0" },
    products_listed: { type: "INT", default: "0" },

    /** 💳 Bank & payout info */
    account_number: { type: "VARCHAR(20)" },
    bank_code: { type: "VARCHAR(10)" },
    bank_name: { type: "VARCHAR(100)" },
    recipient_code: { type: "VARCHAR(100)" },
    settlement_email: { type: "VARCHAR(255)" },

    /** 📈 Analytics & Customer Cache */
    analytics: { type: "JSONB" },
    customers: { type: "JSONB" },

    /** 🏠 Address (JSONB same as user) */
    address: { type: "JSONB" },

    created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
    updated_at: { type: "TIMESTAMPTZ", default: "NOW()" },
  };
}

export const StoreModel = new StoreModelClass();
