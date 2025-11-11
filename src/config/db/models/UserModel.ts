import { BaseModel, SchemaDefinition } from "../helpers/BaseModel.js";

export type AccountType = "user" | "vendor" | "admin";
export type SalesChannel =
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "other";

export type SignupMedium = "signed" | "google";

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
  signup_medium: SignupMedium | null;
  avatar: string | null;
  avatar_public_id: string | null;
  rating_average: number | null;
  rating_count: number | null;
  review_count: number | null;
  created_at: string | null;
  updated_at: string | null;
}

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

    /** 👇 Explicitly default referral_code to NULL */
    referral_code: { type: "VARCHAR(50)", default: "NULL" },

    current_sales_channel: {
      type: "VARCHAR(50) CHECK (current_sales_channel IN ('whatsapp','instagram','facebook','tiktok','other'))",
      default: "'whatsapp'",
    },

    agree_to_terms: { type: "BOOLEAN", default: "true" },
    email_verified: { type: "BOOLEAN", default: "false" },

    password_token: { type: "VARCHAR(255)" },
    password_token_expiration_date: { type: "TIMESTAMP" },
    email_verification_code: { type: "VARCHAR(255)" },
    email_verification_expiration: { type: "TIMESTAMP" },

    otp: { type: "VARCHAR(10)" },
    otp_expiration: { type: "TIMESTAMPTZ" },

    signup_medium: {
      type: "VARCHAR(20) CHECK (signup_medium IN ('signed','google'))",
      default: "'signed'",
      notNull: true,
    },

    avatar: { type: "TEXT" },
    avatar_public_id: { type: "TEXT" },

    rating_average: { type: "NUMERIC(3,2)", default: "0" },
    rating_count: { type: "INT", default: "0" },
    review_count: { type: "INT", default: "0" },

    created_at: { type: "TIMESTAMP", default: "NOW()" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
  };
}

export const UserModel = new UserModelClass();
