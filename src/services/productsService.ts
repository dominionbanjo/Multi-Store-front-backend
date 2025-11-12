import { v4 as uuidv4 } from "uuid";
import slugify from "slugify";
import { ProductModel, IProduct } from "../config/db/models/ProductModel.js";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";

class ProductService {
  // ───────────────────────────────────────────────
  // 🧾 PRODUCT FETCHING
  // ───────────────────────────────────────────────

  static async getProduct(identifier: string): Promise<IProduct> {
    const product =
      (await ProductModel.findOne({ slug: identifier })) ||
      (await ProductModel.findOne({ id: identifier }));

    if (!product) throw new NotFoundError("Product not found");
    return product;
  }

  static async getAllProducts(
    filters: Partial<IProduct> = {},
    options: { page?: number; limit?: number } = {}
  ) {
    const { data, pagination } = await ProductModel.findAll(filters, options);
    return { products: data, pagination };
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

    const filters: Partial<IProduct> = {};
    if (store_id) filters.store_id = store_id;

    const { data, pagination } = await ProductModel.findAll(filters, {
      page,
      limit,
    });

    return { products: data, pagination };
  }

  static async search(q: string, page = 1, limit = 20) {
    if (!q || q.trim() === "")
      throw new BadRequestError("Search term is required");

    const { data, pagination } = await ProductModel.search(q, ["name"], {
      page,
      limit,
    });

    return { products: data, pagination };
  }

  // ───────────────────────────────────────────────
  // 🧱 CREATE / UPDATE / DELETE
  // ───────────────────────────────────────────────

  private static async generateUniqueSlug(name: string) {
    const baseSlug = slugify(name, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;

    while (await ProductModel.findOne({ slug })) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    return slug;
  }

  static async createProduct(
    data: Omit<IProduct, "id" | "created_at" | "updated_at">
  ) {
    if (!data.name || !data.vendor_id || !data.category)
      throw new BadRequestError("Missing required product fields");

    const slug = data.slug || (await this.generateUniqueSlug(data.name));

    const newProduct = await ProductModel.create({
      ...data,
      id: uuidv4(),
      slug,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return newProduct;
  }

  static async updateProduct(productId: string, updates: Partial<IProduct>) {
    if (!productId) throw new BadRequestError("Product ID is required");
    const product = await ProductModel.findById(productId);
    if (!product) throw new NotFoundError("Product not found");

    const updated = await ProductModel.update(productId, {
      ...updates,
      updated_at: new Date().toISOString(),
    });

    return updated;
  }

  static async deleteProduct(productId: string) {
    if (!productId) throw new BadRequestError("Product ID is required");
    await ProductModel.delete(productId);
    return { success: true, message: "Product deleted successfully" };
  }
}

export default ProductService;
