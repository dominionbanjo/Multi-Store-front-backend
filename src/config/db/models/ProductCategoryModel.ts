// src/models/ProductCategoryModel.ts
import { BaseModel, SchemaDefinition } from "../helpers/BaseModel.js";

export interface IProductCategory {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * 🏷️ Product Category Model
 * - Used by products for strict category reference
 * - Supports parent-child nesting (self-referencing FK)
 */
class ProductCategoryModelClass extends BaseModel<IProductCategory> {
  protected table = "product_categories";

  // ✅ Type-safe schema — must exactly match IProductCategory
  protected schema: SchemaDefinition<IProductCategory> = {
    id: { type: "UUID", primaryKey: true },
    name: { type: "VARCHAR(100)", unique: true, notNull: true, index: true },
    slug: { type: "VARCHAR(100)", unique: true, notNull: true, index: true },

    parent_id: {
      type: "UUID",
      references: "product_categories(id)",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      index: true,
    },

    created_at: { type: "TIMESTAMP", default: "NOW()" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
  };
}

export const ProductCategoryModel = new ProductCategoryModelClass();
