import { v4 as uuidv4 } from "uuid";
import slugify from "slugify";
import { ProductModel, IProduct } from "../config/db/models/ProductModel.js";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";
import { ProductColorModel } from "../config/db/models/ColorModel.js";
import { ProductCategoryModel, StoreModel } from "../config/db/models/index.js";
import UploadService from "./uploadService.js";
import sql from "../config/connect.js";

class ProductService {
  // ───────────────────────────────────────────────
  // ⭐ VALIDATE COLORS
  // ───────────────────────────────────────────────
  private static async validateColors(colors?: string[] | null) {
    if (!colors || colors.length === 0) return;

    const normalized = colors.map((c) => c.trim());

    const { data: allColors } = await ProductColorModel.findAll();
    const allowedNames = allColors.map((c) => c.name.trim());

    for (const color of normalized) {
      if (!allowedNames.includes(color)) {
        throw new BadRequestError(`Invalid color: '${color}'`);
      }
    }
  }

  // ⭐ VALIDATE CATEGORY
  private static async validateCategory(category: string) {
    if (!category) throw new BadRequestError("Category is required");

    const normalized = category.trim();
    const existing = await ProductCategoryModel.findOne({ name: normalized });

    if (!existing) {
      throw new BadRequestError(`Invalid category: '${normalized}'`);
    }
  }

  // ⭐ UPDATE TSVECTOR FIELD (Reusable)
  private static async refreshSearchVector(productId: string) {
    await sql.unsafe(
      `
      UPDATE products
      SET search_vector = 
        setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
        setweight(to_tsvector('english', array_to_string(tags, ' ')), 'A') ||
        setweight(to_tsvector('english', array_to_string(highlights, ' ')), 'B')
      WHERE id = $1
    `,
      [productId]
    );
  }

  // ───────────────────────────────────────────────
  // 🧾 PRODUCT FETCHING
  // ───────────────────────────────────────────────

  static async getProduct(identifier: string): Promise<IProduct> {
    if (!identifier)
      throw new BadRequestError("Product identifier is required");

    // Detect UUID using same regex as StoreService
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        identifier
      );

    const product = isUUID
      ? await ProductModel.findOne({ id: identifier })
      : await ProductModel.findOne({ slug: identifier });

    if (!product) throw new NotFoundError("Product not found");

    return product;
  }

  static async getAllProducts(
    filters: Partial<IProduct> = {},
    options: any = {}
  ) {
    const { data, pagination } = await ProductModel.findAll(filters, options);
    return { pagination, products: data };
  }

  static async getProductsByStore({
    store_id,
    page = 1,
    limit = 20,
  }: {
    vendor_id?: string;
    store_id?: string;
    page?: number;
    limit?: number;
  }) {
    if (!store_id) throw new BadRequestError("Store ID is required");

    const { data, pagination } = await ProductModel.findAll(
      { store_id },
      { page, limit }
    );

    return { pagination, products: data };
  }

  // ───────────────────────────────────────────────
  // 🔍 FULL TEXT SEARCH
  // ───────────────────────────────────────────────
  static async search(q: string, page = 1, limit = 20) {
    if (!q || q.trim() === "")
      throw new BadRequestError("Search term is required");

    const offset = (page - 1) * limit;

    const tsQuery = q
      .split(" ")
      .map((word) => `${word}:*`)
      .join(" & ");

    // MAIN SEARCH
    const products = await sql.unsafe<IProduct[]>(
      `
      SELECT *
      FROM products
      WHERE search_vector @@ to_tsquery('english', $1)
      ORDER BY ts_rank(search_vector, to_tsquery('english', $1)) DESC
      LIMIT $2 OFFSET $3
    `,
      [tsQuery, limit, offset]
    );

    // COUNT RESULTS
    const [count] = await sql.unsafe<{ total: string }[]>(
      `
      SELECT COUNT(*) AS total
      FROM products
      WHERE search_vector @@ to_tsquery('english', $1)
    `,
      [tsQuery]
    );

    const total = Number(count.total);
    const total_pages = Math.ceil(total / limit);

    return {
      pagination: { page, limit, total, total_pages },
      products,
    };
  }

  // ───────────────────────────────────────────────
  // 🧱 CREATE / UPDATE / DELETE
  // ───────────────────────────────────────────────

  private static async generateUniqueSlug(name: string) {
    const baseSlug = slugify(name, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;

    while (await ProductModel.findOne({ slug })) {
      slug = `${baseSlug}-${++counter}`;
    }

    return slug;
  }

  // ➕ CREATE PRODUCT
  static async createProduct(
    data: Omit<IProduct, "id" | "created_at" | "updated_at">,
    files?: { image?: Express.Multer.File[]; gallery?: Express.Multer.File[] }
  ) {
    data.category = data.category.trim();
    await this.validateCategory(data.category);
    await this.validateColors(data.colors);

    const image = await UploadService.uploadSingle(
      files?.image?.[0],
      "easystore/products/main"
    );

    const gallery = await UploadService.uploadMultiple(
      files?.gallery,
      "easystore/products/gallery"
    );

    const slug = data.slug || (await this.generateUniqueSlug(data.name));

    const product = await ProductModel.create({
      ...data,
      id: uuidv4(),
      slug,
      image,
      gallery,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await this.refreshSearchVector(product.id);

    return product;
  }

  // ➕ CREATE PRODUCT FOR STORE
  static async createProductForStore(
    data: Omit<IProduct, "id" | "created_at" | "updated_at">,
    files?: { image?: Express.Multer.File[]; gallery?: Express.Multer.File[] }
  ) {
    if (!data.store_id)
      throw new BadRequestError("Store ID is required for store product");

    const store = await StoreModel.findOne({ id: data.store_id });
    if (!store) throw new NotFoundError("Store not found");

    data.category = data.category.trim();

    await this.validateCategory(data.category);
    await this.validateColors(data.colors);

    const image = await UploadService.uploadSingle(
      files?.image?.[0],
      "easystore/products/main"
    );

    const gallery = await UploadService.uploadMultiple(
      files?.gallery,
      "easystore/products/gallery"
    );

    const slug = data.slug || (await this.generateUniqueSlug(data.name));

    const product = await ProductModel.create({
      ...data,
      id: uuidv4(),
      slug,
      image,
      gallery,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await this.refreshSearchVector(product.id);

    await StoreModel.update(data.store_id, {
      total_products: Number(store.total_products || 0) + 1,
      products_listed: Number(store.products_listed || 0) + 1,
      updated_at: new Date().toISOString(),
    });

    return product;
  }

  // ✏️ UPDATE PRODUCT
  static async updateProduct(
    productId: string,
    updates: Partial<IProduct>,
    files?: { image?: Express.Multer.File[]; gallery?: Express.Multer.File[] }
  ) {
    const existing = await ProductModel.findById(productId);
    if (!existing) throw new NotFoundError("Product not found");

    // Validate category + colors
    if (updates.category) await this.validateCategory(updates.category);
    if (updates.colors) await this.validateColors(updates.colors);

    // --------------------------------------------
    // 📸 Replace main image
    // --------------------------------------------
    if (files?.image?.[0]) {
      if (existing.image?.public_id) {
        await UploadService.deleteSingle(existing.image.public_id);
      }

      updates.image = await UploadService.uploadSingle(
        files.image[0],
        "easystore/products/main"
      );
    }

    // --------------------------------------------
    // 📸 Append gallery images (objects, NOT strings)
    // --------------------------------------------
    if (files?.gallery?.length) {
      const newGallery = await UploadService.uploadMultiple(
        files.gallery,
        "easystore/products/gallery"
      );

      // gallery items are objects → no trim()
      updates.gallery = [...(existing.gallery || []), ...newGallery];
    }

    // --------------------------------------------
    // 🔤 Append string-array fields ONLY
    // --------------------------------------------
    const stringArrayFields: (keyof IProduct)[] = [
      "tags",
      "highlights",
      "colors",
      "sizes",
    ];

    for (const field of stringArrayFields) {
      const incoming = updates[field];

      if (incoming !== undefined && incoming !== null) {
        // ensure array
        const parsedIncoming = Array.isArray(incoming)
          ? incoming
          : String(incoming)
              .split(",")
              .map((x) => x.trim());

        const existingValues = (existing[field] as string[]) || [];

        // merge + trim strings only
        const merged = [...existingValues, ...parsedIncoming]
          .map((x) => (typeof x === "string" ? x.trim() : x))
          .filter((x) => typeof x === "string" && x.length > 0);

        // ensure uniqueness
        updates[field] = Array.from(new Set(merged)) as any;
      }
    }

    // --------------------------------------------
    // 🔤 Update slug if name changed
    // --------------------------------------------
    if (updates.name && updates.name !== existing.name) {
      updates.slug = await this.generateUniqueSlug(updates.name);
    }

    // --------------------------------------------
    // 💾 Save update
    // --------------------------------------------
    const updated = await ProductModel.update(productId, {
      ...updates,
      updated_at: new Date().toISOString(),
    });

    // Refresh search vector
    await this.refreshSearchVector(productId);

    return updated;
  }

  // ❌ DELETE PRODUCT
  static async deleteProduct(productId: string) {
    if (!productId) throw new BadRequestError("Product ID is required");

    await ProductModel.delete(productId);

    return { success: true, message: "Product deleted successfully" };
  }
}

export default ProductService;
