import { BaseModel, SchemaDefinition } from "../helpers/BaseModel.js";

export interface IProductReview {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * ⭐ Product Review Model
 * - Defines relationships to `products` and `users`
 * - Auto-deletes when product or user is deleted
 * - Enforces rating integrity (1–5)
 */
class ProductReviewModelClass extends BaseModel<IProductReview> {
  protected table = "product_reviews";

  protected schema: SchemaDefinition<IProductReview> = {
    id: { type: "UUID", primaryKey: true },

    product_id: {
      type: "UUID",
      notNull: true,
      notNullMessage: "Product ID is required",
      references: "products(id)",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      index: true,
    },

    user_id: {
      type: "UUID",
      notNull: true,
      notNullMessage: "User ID is required",
      references: "users(id)",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      index: true,
    },

    rating: {
      type: "INT",
      notNull: true,
      notNullMessage: "Rating is required",
      min: 1,
      max: 5,
    },

    comment: {
      type: "TEXT",
      notNull: true,
      notNullMessage: "Comment is required",
    },

    created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
    updated_at: { type: "TIMESTAMPTZ", default: "NOW()" },
  };
}

export const ProductReviewModel = new ProductReviewModelClass();
