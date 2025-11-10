import { BaseModel, SchemaDefinition } from "../helpers/BaseModel.js";

export type AccountType = "user" | "vendor";
export type SalesChannel =
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "other";

export interface IUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string | null;
  phone_number: string | null;
  account_type: AccountType;
  store_id: string | null;
  store_name: string | null;
  username: string | null;
  referral_code: string | null;
  current_sales_channel: SalesChannel | null;
  agree_to_terms: boolean | null;
  email_verified: boolean | null;
  password_token: string | null;
  password_token_expiration_date: string | null;
  email_verification_code: string | null;
  email_verification_expiration: string | null;
  otp: string | null;
  otp_expiration: string | null;
  signup_medium: string | null;
  avatar: string | null;
  avatar_public_id: string | null;

  /** ⭐ Vendor performance stats */
  rating_average: number | null;
  rating_count: number | null;
  review_count: number | null;

  created_at: string | null;
  updated_at: string | null;
}

/**
 * 🧩 User Model
 * - Enforces enum for current_sales_channel
 * - Vendors can have aggregated rating scores from their products
 * - Linked to `stores` via store_id
 */
class UserModelClass extends BaseModel<IUser> {
  protected table = "users";

  protected schema: SchemaDefinition<IUser> = {
    id: { type: "UUID", primaryKey: true },

    first_name: { type: "VARCHAR(100)", notNull: true },
    last_name: { type: "VARCHAR(100)", notNull: true },

    email: { type: "VARCHAR(255)", unique: true, notNull: true, index: true },
    password: { type: "TEXT" },
    phone_number: { type: "VARCHAR(20)" },

    account_type: {
      type: "VARCHAR(20) CHECK (account_type IN ('user','vendor','admin'))",
      default: "'user'",
      notNull: true,
      index: true,
    },

    store_id: {
      type: "UUID",
      references: "stores(id)",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      index: true,
    },

    store_name: { type: "VARCHAR(100)" },
    username: { type: "VARCHAR(100)" },
    referral_code: { type: "VARCHAR(50)" },

    /** 🛍️ Limit current_sales_channel to enum values */
    current_sales_channel: {
      type: "VARCHAR(50) CHECK (current_sales_channel IN ('whatsapp','instagram','facebook','tiktok','other'))",
      default: "'WhatsApp'",
    },

    agree_to_terms: { type: "BOOLEAN", default: "true" },
    email_verified: { type: "BOOLEAN", default: "false" },

    password_token: { type: "VARCHAR(255)" },
    password_token_expiration_date: { type: "TIMESTAMP" },
    email_verification_code: { type: "VARCHAR(255)" },
    email_verification_expiration: { type: "TIMESTAMP" },

    otp: { type: "VARCHAR(10)" },
    otp_expiration: { type: "TIMESTAMPTZ" },
    signup_medium: { type: "VARCHAR(20)", default: "'signed'" },

    avatar: { type: "TEXT" },
    avatar_public_id: { type: "TEXT" },

    /** ⭐ Vendor performance fields */
    rating_average: { type: "NUMERIC(3,2)", default: "0" },
    rating_count: { type: "INT", default: "0" },
    review_count: { type: "INT", default: "0" },

    created_at: { type: "TIMESTAMP", default: "NOW()" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
  };
}

export const UserModel = new UserModelClass();
