import { BaseModel, SchemaDefinition } from "../helpers/BaseModel.js";

export interface IProductColor {
  id: string;
  name: string;
  hex: string;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * 🎨 Product Color Model
 * - Used for consistent color management
 * - Products can reference colors by UUID (color_ids[])
 */
class ProductColorModelClass extends BaseModel<IProductColor> {
  protected table = "product_colors";

  protected schema: SchemaDefinition<IProductColor> = {
    id: { type: "UUID", primaryKey: true },

    name: {
      type: "VARCHAR(100)",
      notNull: true,
      unique: true,
      index: true,
      notNullMessage: "Color name is required",
    },

    hex: {
      type: "VARCHAR(7)",
      notNull: true,
      unique: true,
      index: true,
      notNullMessage: "Color hex value is required",
    },

    created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
    updated_at: { type: "TIMESTAMPTZ", default: "NOW()" },
  };
}

export const ProductColorModel = new ProductColorModelClass();
