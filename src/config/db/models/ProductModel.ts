// src/models/ProductModel.ts
import { BaseModel, SchemaDefinition } from "../helpers/BaseModel.js";
import { ProductReviewModel, IProductReview } from "./ReviewModel.js";

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
  rating_average: number | null;
  rating_count: number | null;
  review_count: number | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * 🛍️ Product Model
 * - Belongs to vendor (user) and optionally a store
 * - References product_categories for strict category linkage
 * - Auto-linked with reviews via product_reviews.product_id
 */
class ProductModelClass extends BaseModel<IProduct> {
  protected table = "products";

  // ✅ Type-safe schema — keys must match IProduct exactly
  protected schema: SchemaDefinition<IProduct> = {
    id: { type: "UUID", primaryKey: true },

    vendor_id: {
      type: "UUID",
      notNull: true,
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
      references: "product_categories(id)",
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
      index: true,
    },

    name: { type: "VARCHAR(255)", notNull: true, index: true },
    slug: { type: "VARCHAR(255)", unique: true, notNull: true, index: true },
    description: { type: "TEXT" },

    price: { type: "NUMERIC(10,2)", notNull: true },
    discount_price: { type: "NUMERIC(10,2)" },
    stock: { type: "INT", default: "0", notNull: true },

    tags: { type: "TEXT[]" },
    image: { type: "TEXT" },
    gallery: { type: "TEXT[]" },

    rating_average: { type: "NUMERIC(3,2)", default: "0" },
    rating_count: { type: "INT", default: "0" },
    review_count: { type: "INT", default: "0" },

    created_at: { type: "TIMESTAMP", default: "NOW()" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
  };
}

export const ProductModel = new ProductModelClass();
