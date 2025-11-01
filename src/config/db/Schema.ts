import { defineModel } from "./modelRegistry.js";

/** ─── USERS TABLE ─── **/
export const UserModel = defineModel({
  tableName: "users",
  fields: {
    id: { type: "UUID", primaryKey: true },
    first_name: { type: "VARCHAR(100)", notNull: true },
    last_name: { type: "VARCHAR(100)", notNull: true },
    phone_number: { type: "VARCHAR(20)" },
    email: { type: "VARCHAR(255)", unique: true, notNull: true },
    password: { type: "TEXT" },
    account_type: { type: "VARCHAR(20)", default: "'user'", notNull: true },
    store_name: { type: "VARCHAR(100)" },
    username: { type: "VARCHAR(100)" },
    referral_code: { type: "VARCHAR(50)" },
    current_sales_channel: { type: "VARCHAR(50)" },
    agree_to_terms: { type: "BOOLEAN", default: "true" },

    // 🔒 Email verification + password reset
    password_token: { type: "VARCHAR(255)" },
    password_token_expiration_date: { type: "TIMESTAMP" },
    email_verified: { type: "BOOLEAN", default: "false" },
    email_verification_code: { type: "VARCHAR(255)" },
    email_verification_expiration: { type: "TIMESTAMP" },

    // 🔢 OTP and signup
    otp: { type: "VARCHAR(10)" },
    otp_expiration: { type: "TIMESTAMPTZ" },
    signup_medium: { type: "VARCHAR(20)", default: "'signed'" },

    // 🖼️ Media
    avatar: { type: "TEXT" },
    avatar_public_id: { type: "TEXT" },

    // 🕓 Timestamps
    created_at: { type: "TIMESTAMP", default: "NOW()" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
  },
});

/** ─── STORES TABLE ─── **/
export const StoreModel = defineModel({
  tableName: "stores",
  fields: {
    id: { type: "UUID", primaryKey: true },
    user_id: { type: "UUID", notNull: true, references: "users(id)" },
    store_name: { type: "VARCHAR(255)", notNull: true },
    username: { type: "VARCHAR(100)", unique: true },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
  },
});

/** ─── PRODUCTS TABLE ─── **/
export const ProductModel = defineModel({
  tableName: "products",
  fields: {
    id: { type: "UUID", primaryKey: true },
    vendor_id: { type: "UUID", notNull: true, references: "users(id)" },
    name: { type: "VARCHAR(255)", notNull: true },
    description: { type: "TEXT" },
    price: { type: "NUMERIC(10,2)", notNull: true },
    stock: { type: "INT", default: "0" },
    category: { type: "VARCHAR(50)" },
    image: { type: "TEXT" },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
  },
});

/** ─── CART TABLE ─── **/
export const CartModel = defineModel({
  tableName: "cart",
  fields: {
    id: { type: "UUID", primaryKey: true },
    user_id: { type: "UUID", notNull: true, references: "users(id)" },
    product_id: { type: "UUID", notNull: true, references: "products(id)" },
    name: { type: "VARCHAR(255)", notNull: true },
    price: { type: "NUMERIC(10,2)", notNull: true },
    image: { type: "TEXT" },
    quantity: { type: "INT", default: "1" },
    stock: { type: "INT", default: "0" },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
  },
});

/** ─── WISHLIST TABLE ─── **/
export const WishlistModel = defineModel({
  tableName: "wishlist",
  fields: {
    id: { type: "UUID", primaryKey: true },
    user_id: { type: "UUID", notNull: true, references: "users(id)" },
    product_id: { type: "UUID", notNull: true, references: "products(id)" },
    name: { type: "VARCHAR(255)", notNull: true },
    image: { type: "TEXT" },
    price: { type: "NUMERIC(10,2)", notNull: true },
    stock: { type: "INT", default: "0" },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
  },
});
