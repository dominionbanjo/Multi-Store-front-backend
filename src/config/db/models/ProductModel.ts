import { BaseModel, SchemaDefinition } from "../helpers/BaseModel.js";

export interface IProductImage {
  url: string;
  public_id: string;
}

export interface IProductGalleryItem {
  url: string;
  public_id: string;
}

export interface IProduct {
  id: string;
  vendor_id: string;
  store_id: string;
  category: string;
  name: string;
  slug: string;
  description: string | null;

  price: number;
  discount_price: number | null;
  stock: number;

  tags: string[] | null;

  // ⭐ FIXED
  image: IProductImage | null; // <-- FIXED: WAS string
  gallery: IProductGalleryItem[] | null; // <-- FIXED

  highlights: string[] | null;
  specs: Record<string, string> | null;
  colors: string[] | null;
  sizes: string[] | null;

  shipping_note: string | null;
  returns_note: string | null;
  location: string | null;
  shipping_cost: number | null;

  rating_average: number | null;
  rating_count: number | null;
  review_count: number | null;

  created_at: string | null;
  updated_at: string | null;
  search_vector: string | null;
}

class ProductModelClass extends BaseModel<IProduct> {
  protected table = "products";

  protected schema: SchemaDefinition<IProduct> = {
    id: { type: "UUID", primaryKey: true },

    vendor_id: {
      type: "UUID",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },

    store_id: {
      type: "UUID",
      references: "stores(id)",
      onDelete: "CASCADE",
    },

    category: {
      type: "VARCHAR(100)",
      notNull: true,
      references: "product_categories(name)",
    },

    name: { type: "VARCHAR(255)", notNull: true },
    slug: { type: "VARCHAR(255)", unique: true, notNull: true },
    description: { type: "TEXT" },

    price: { type: "NUMERIC(10,2)", notNull: true },
    discount_price: { type: "NUMERIC(10,2)" },
    stock: { type: "INT", default: "0", notNull: true },

    tags: { type: "TEXT[]" },

    // ⭐ FIXED
    image: { type: "JSONB" }, // <-- FIXED
    gallery: { type: "JSONB" }, // <-- FIXED

    highlights: { type: "TEXT[]" },
    specs: { type: "JSONB" },
    colors: { type: "TEXT[]" },
    sizes: { type: "TEXT[]" },

    shipping_note: { type: "TEXT" },
    returns_note: { type: "TEXT" },
    location: { type: "VARCHAR(255)" },
    shipping_cost: { type: "NUMERIC(10,2)" },

    rating_average: { type: "NUMERIC(3,2)", default: "0" },
    rating_count: { type: "INT", default: "0" },
    review_count: { type: "INT", default: "0" },

    created_at: { type: "TIMESTAMPTZ", default: "NOW()" },
    updated_at: { type: "TIMESTAMPTZ", default: "NOW()" },

    search_vector: { type: "TSVECTOR" },
  };
}

export const ProductModel = new ProductModelClass();
