import { BaseModel, SchemaDefinition } from "../helpers/BaseModel.js";

export interface IProduct {
  id: string;
  vendor_id: string;
  store_id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  discount_price: number | null;
  stock: number;
  tags: string[] | null;
  image: string | null;
  gallery: string[] | null;

  // 🆕 Additions to support frontend data
  highlights: string[] | null;
  specs: Record<string, string> | null;
  colors: string[] | null;
  sizes: string[] | null;

  // 🆕 Shipping & Returns
  shipping_note: string | null;
  returns_note: string | null;
  location: string | null;
  shipping_cost: number | null;

  rating_average: number | null;
  rating_count: number | null;
  review_count: number | null;

  created_at: string | null;
  updated_at: string | null;
}

/**
 * 🛍️ Product Model
 * - Validates numeric fields (price, stock, shipping)
 * - Enforces required vendor/store/category linkage
 * - Supports flexible frontend properties (highlights, specs, etc.)
 */
class ProductModelClass extends BaseModel<IProduct> {
  protected table = "products";

  protected schema: SchemaDefinition<IProduct> = {
    id: { type: "UUID", primaryKey: true },

    vendor_id: {
      type: "UUID",
      notNull: true,
      notNullMessage: "Vendor ID is required",
      references: "users(id)",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      index: true,
    },

    store_id: {
      type: "UUID",
      references: "stores(id)",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      index: true,
    },

    category_id: {
      type: "UUID",
      notNull: true,
      notNullMessage: "Category is required",
      references: "product_categories(id)",
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
      index: true,
    },

    name: {
      type: "VARCHAR(255)",
      notNull: true,
      notNullMessage: "Product name is required",
      index: true,
    },

    slug: {
      type: "VARCHAR(255)",
      unique: true,
      notNull: true,
      notNullMessage: "Slug is required",
      index: true,
    },

    description: { type: "TEXT" },

    price: {
      type: "NUMERIC(10,2)",
      notNull: true,
      notNullMessage: "Price is required",
      min: 1,
    },

    discount_price: {
      type: "NUMERIC(10,2)",
      min: 0,
      max: 9999999,
    },

    stock: {
      type: "INT",
      default: "0",
      notNull: true,
      min: 0,
    },

    tags: { type: "TEXT[]" },
    image: { type: "TEXT" },
    gallery: { type: "TEXT[]" },

    highlights: { type: "TEXT[]" },
    specs: { type: "JSONB" },
    colors: { type: "TEXT[]" },
    sizes: { type: "TEXT[]" },

    shipping_note: { type: "TEXT" },
    returns_note: { type: "TEXT" },
    location: { type: "VARCHAR(255)" },

    shipping_cost: {
      type: "NUMERIC(10,2)",
      min: 0,
      max: 100000,
    },

    rating_average: { type: "NUMERIC(3,2)", default: "0" },
    rating_count: { type: "INT", default: "0" },
    review_count: { type: "INT", default: "0" },

    created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
    updated_at: { type: "TIMESTAMPTZ", default: "NOW()" },
  };
}

export const ProductModel = new ProductModelClass();
