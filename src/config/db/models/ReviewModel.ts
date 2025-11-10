import { BaseModel } from "../helpers/BaseModel.js";

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
 * - Linked to both `products` and `users`
 * - Auto-deletes if product or user is removed
 */
class ProductReviewModelClass extends BaseModel<IProductReview> {
  protected table = "product_reviews";

  protected schema = {
    id: { type: "UUID", primaryKey: true },

    product_id: {
      type: "UUID",
      notNull: true,
      references: "products(id)",
      onDelete: "CASCADE", // delete all reviews when product is deleted
      onUpdate: "CASCADE",
      index: true,
    },

    user_id: {
      type: "UUID",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE", // delete all user reviews when user is deleted
      onUpdate: "CASCADE",
      index: true,
    },

    rating: { type: "INT", notNull: true },
    comment: { type: "TEXT" },

    created_at: { type: "TIMESTAMP", default: "NOW()" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
  };
}

export const ProductReviewModel = new ProductReviewModelClass();
