import { v4 as uuidv4 } from "uuid";
import slugify from "slugify";
import { ProductModel, IProduct } from "../config/db/models/ProductModel.js";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";
import { ProductColorModel } from "../config/db/models/ColorModel.js";
import { ProductCategoryModel, StoreModel } from "../config/db/models/index.js";
import UploadService from "./uploadService.js";
import sql from "../config/connect.js";
import { ServiceCache } from "../utils/helpers/ServiceCache.js";

class ProductService {
  // ======================================================================
  // VALIDATIONS
  // ======================================================================
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

  private static async validateCategory(category: string) {
    if (!category) throw new BadRequestError("Category is required");

    const normalized = category.trim();
    const existing = await ProductCategoryModel.findOne({ name: normalized });

    if (!existing) {
      throw new BadRequestError(`Invalid category: '${normalized}'`);
    }
  }

  private static async refreshSearchVector(productId: string) {
    await sql.unsafe(
      `
      UPDATE products
      SET search_vector = 
        setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
        setweight(to_tsvector('english', array_to_string(tags, ' ')), 'A') ||
        setweight(to_tsvector('english', array_to_string(highlights, '')), 'B')
      WHERE id = $1
    `,
      [productId]
    );
  }

  // ======================================================================
  // FETCHING OPERATIONS (CACHED)
  // ======================================================================

  static async getProduct(identifier: string): Promise<IProduct> {
    if (!identifier)
      throw new BadRequestError("Product identifier is required");

    const key = ServiceCache.key("product", "single", identifier);

    const cached = await ServiceCache.get<IProduct>(key);
    if (cached) return cached;

    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        identifier
      );

    const product = isUUID
      ? await ProductModel.findOne({ id: identifier })
      : await ProductModel.findOne({ slug: identifier });

    if (!product) throw new NotFoundError("Product not found");

    await ServiceCache.set(key, product, 60);
    return product;
  }

  static async getAllProducts(
    filters: Partial<IProduct> = {},
    options: any = {}
  ) {
    const key = ServiceCache.key("product", "list", { filters, options });

    const cached = await ServiceCache.get<{
      products: IProduct[];
      pagination: any;
    }>(key);
    if (cached) return cached;

    const { data, pagination } = await ProductModel.findAll(filters, options);

    const response = { pagination, products: data };
    await ServiceCache.set(key, response, 60);

    return response;
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

    const key = ServiceCache.key("product", "store", { store_id, page, limit });

    const cached = await ServiceCache.get<{
      pagination: any;
      products: IProduct[];
    }>(key);
    if (cached) return cached;

    const { data, pagination } = await ProductModel.findAll(
      { store_id },
      { page, limit }
    );

    const response = { pagination, products: data };
    await ServiceCache.set(key, response, 60);

    return response;
  }

  static async search(q: string, page = 1, limit = 20) {
    if (!q.trim()) throw new BadRequestError("Search term is required");

    const key = ServiceCache.key("product", "search", { q, page, limit });

    const cached = await ServiceCache.get<any>(key);
    if (cached) return cached;

    const offset = (page - 1) * limit;

    const tsQuery = q
      .split(" ")
      .map((w) => `${w}:*`)
      .join(" & ");

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

    const response = {
      pagination: { page, limit, total, total_pages },
      products,
    };

    await ServiceCache.set(key, response, 60);

    return response;
  }

  // ======================================================================
  // CREATE / UPDATE / DELETE WITH CACHE INVALIDATION
  // ======================================================================

  private static async generateUniqueSlug(name: string) {
    const baseSlug = slugify(name, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;

    while (await ProductModel.findOne({ slug })) {
      slug = `${baseSlug}-${++counter}`;
    }

    return slug;
  }

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

    await ServiceCache.clear("svc:product"); // invalidate all product caches

    return product;
  }

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

    await ServiceCache.clear("svc:product");

    return product;
  }

  static async updateProduct(
    productId: string,
    updates: Partial<IProduct>,
    files?: { image?: Express.Multer.File[]; gallery?: Express.Multer.File[] }
  ) {
    const existing = await ProductModel.findById(productId);
    if (!existing) throw new NotFoundError("Product not found");

    if (updates.category) await this.validateCategory(updates.category);
    if (updates.colors) await this.validateColors(updates.colors);

    if (files?.image?.[0]) {
      if (existing.image?.public_id) {
        await UploadService.deleteSingle(existing.image.public_id);
      }

      updates.image = await UploadService.uploadSingle(
        files.image[0],
        "easystore/products/main"
      );
    }

    if (files?.gallery?.length) {
      const newGallery = await UploadService.uploadMultiple(
        files.gallery,
        "easystore/products/gallery"
      );

      updates.gallery = [...(existing.gallery || []), ...newGallery];
    }

    const stringArrayFields: (keyof IProduct)[] = [
      "tags",
      "highlights",
      "colors",
      "sizes",
    ];

    for (const field of stringArrayFields) {
      const incoming = updates[field];

      if (incoming !== undefined && incoming !== null) {
        const parsedIncoming = Array.isArray(incoming)
          ? incoming
          : String(incoming)
              .split(",")
              .map((x) => x.trim());

        const existingValues = (existing[field] as string[]) || [];

        updates[field] = Array.from(
          new Set([...existingValues, ...parsedIncoming])
        ) as any;
      }
    }

    if (updates.name && updates.name !== existing.name) {
      updates.slug = await this.generateUniqueSlug(updates.name);
    }

    const updated = await ProductModel.update(productId, {
      ...updates,
      updated_at: new Date().toISOString(),
    });

    await this.refreshSearchVector(productId);

    await ServiceCache.clear("svc:product");

    return updated;
  }

  static async deleteProduct(productId: string) {
    if (!productId) throw new BadRequestError("Product ID is required");

    await ProductModel.delete(productId);

    await ServiceCache.clear("svc:product");

    return { success: true, message: "Product deleted successfully" };
  }
}

export default ProductService;
