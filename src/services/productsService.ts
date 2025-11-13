import { v4 as uuidv4 } from "uuid";
import slugify from "slugify";
import { ProductModel, IProduct } from "../config/db/models/ProductModel.js";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";
import { ProductColorModel } from "../config/db/models/ColorModel.js";
import { ProductCategoryModel, StoreModel } from "../config/db/models/index.js";
import UploadService from "./uploadService.js";

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

    return { products: data, pagination };
  }

  static async search(q: string, page = 1, limit = 20) {
    if (!q || q.trim() === "")
      throw new BadRequestError("Search term is required");

    const { data, pagination } = await ProductModel.search(q, ["name"], {
      page,
      limit,
    });

    return { pagination, products: data };
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

  // ───────────────────────────────────────────────
  // ➕ CREATE PRODUCT
  // ───────────────────────────────────────────────
  static async createProduct(
    data: Omit<IProduct, "id" | "created_at" | "updated_at">,
    files?: { image?: Express.Multer.File[]; gallery?: Express.Multer.File[] }
  ) {
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

    return await ProductModel.create({
      ...data,
      id: uuidv4(),
      slug,
      image,
      gallery,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // ───────────────────────────────────────────────
  // ➕ CREATE PRODUCT FOR STORE
  // ───────────────────────────────────────────────
  static async createProductForStore(
    data: Omit<IProduct, "id" | "created_at" | "updated_at">,
    files?: { image?: Express.Multer.File[]; gallery?: Express.Multer.File[] }
  ) {
    if (!data.store_id)
      throw new BadRequestError("Store ID is required for store product");

    const store = await StoreModel.findOne({ id: data.store_id });
    if (!store) throw new NotFoundError("Store not found");

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

    return await ProductModel.create({
      ...data,
      id: uuidv4(),
      slug,
      image,
      gallery,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // ───────────────────────────────────────────────
  // ✏️ UPDATE PRODUCT
  // ───────────────────────────────────────────────
  static async updateProduct(
    productId: string,
    updates: Partial<IProduct>,
    files?: { image?: Express.Multer.File[]; gallery?: Express.Multer.File[] }
  ) {
    const existing = await ProductModel.findById(productId);
    if (!existing) throw new NotFoundError("Product not found");

    if (updates.category) await this.validateCategory(updates.category);
    if (updates.colors) await this.validateColors(updates.colors);

    // Replace main image
    if (files?.image?.[0]) {
      await UploadService.deleteSingle(existing.image?.public_id);
      updates.image = await UploadService.uploadSingle(
        files.image[0],
        "easystore/products/main"
      );
    }

    // Replace gallery
    if (files?.gallery?.length) {
      await UploadService.deleteMultiple(existing.gallery);
      updates.gallery = await UploadService.uploadMultiple(
        files.gallery,
        "easystore/products/gallery"
      );
    }

    // New slug if name changed
    if (updates.name && updates.name !== existing.name) {
      updates.slug = await this.generateUniqueSlug(updates.name);
    }

    return await ProductModel.update(productId, {
      ...updates,
      updated_at: new Date().toISOString(),
    });
  }

  // ───────────────────────────────────────────────
  // ❌ DELETE PRODUCT
  // ───────────────────────────────────────────────
  static async deleteProduct(productId: string) {
    if (!productId) throw new BadRequestError("Product ID is required");
    await ProductModel.delete(productId);
    return { success: true, message: "Product deleted successfully" };
  }
}

export default ProductService;
