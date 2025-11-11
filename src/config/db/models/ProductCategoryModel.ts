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
 * - Ensures name and slug are required and unique
 */
class ProductCategoryModelClass extends BaseModel<IProductCategory> {
  protected table = "product_categories";

  protected schema: SchemaDefinition<IProductCategory> = {
    id: { type: "UUID", primaryKey: true },

    name: {
      type: "VARCHAR(100)",
      notNull: true,
      notNullMessage: "Category name is required",
      unique: true,
      index: true,
    },

    slug: {
      type: "VARCHAR(100)",
      notNull: true,
      notNullMessage: "Category slug is required",
      unique: true,
      index: true,
    },

    parent_id: {
      type: "UUID",
      references: "product_categories(id)",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      index: true,
    },

    created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
    updated_at: { type: "TIMESTAMPTZ", default: "NOW()" },
  };

  /**
   * 🧠 Auto-generate slug from name if not provided
   */
  async create(data: Partial<IProductCategory>): Promise<IProductCategory> {
    if (!data.name) throw new Error("Category name is required");

    // Auto-generate slug
    const slug =
      data.slug ||
      data.name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");

    return super.create({
      ...data,
      slug,
    });
  }

  /**
   * 🧾 Fetch all categories, including nested subcategories (if any)
   */
  async getAllCategories(): Promise<IProductCategory[]> {
    const { data } = await this.findAll({}, { limit: 1000 });
    return data;
  }

  /**
   * 🔍 Find all subcategories of a given parent_id
   */
  async getSubcategories(parent_id: string): Promise<IProductCategory[]> {
    const { data } = await this.findAll({ parent_id });
    return data;
  }
}

export const ProductCategoryModel = new ProductCategoryModelClass();
