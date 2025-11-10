import { v4 as uuidv4 } from "uuid";
import { ProductModel, IProduct } from "../config/db/models/ProductModel.js";
import {
  IProductReview,
  ProductReviewModel,
} from "../config/db/models/ReviewModel.js";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";

class ProductService {
  // ───────────────────────────────────────────────
  // 🧾 PRODUCT FETCHING
  // ───────────────────────────────────────────────

  /** 🔍 Get a single product by ID or slug */
  static async getProduct(identifier: string): Promise<IProduct> {
    const product =
      (await ProductModel.findOne({ slug: identifier })) ||
      (await ProductModel.findOne({ id: identifier }));

    if (!product) throw new NotFoundError("Product not found");
    return product;
  }

  /** 🧾 Get all products (with optional filters + pagination) */
  static async getAllProducts(
    filters: Partial<IProduct> = {},
    options: { page?: number; limit?: number } = {}
  ) {
    const { data, pagination } = await ProductModel.findAll(filters, options);
    return { products: data, pagination };
  }

  /** 🏬 Get products by vendor or store */
  static async getByVendorOrStore({
    vendor_id,
    store_id,
    page = 1,
    limit = 20,
  }: {
    vendor_id?: string;
    store_id?: string;
    page?: number;
    limit?: number;
  }) {
    if (!vendor_id && !store_id)
      throw new BadRequestError("Vendor ID or Store ID is required");

    const filters: Partial<IProduct> = {};
    if (vendor_id) filters.vendor_id = vendor_id;
    if (store_id) filters.store_id = store_id;

    const { data, pagination } = await ProductModel.findAll(filters, {
      page,
      limit,
    });

    return { products: data, pagination };
  }

  /** 🔎 Search products by name or tag */
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

  /** ➕ Create a new product */
  static async createProduct(
    data: Omit<IProduct, "id" | "created_at" | "updated_at">
  ) {
    if (!data.name || !data.vendor_id || !data.category_id)
      throw new BadRequestError("Missing required product fields");

    const newProduct = await ProductModel.create({
      ...data,
      id: uuidv4(),
      slug: data.slug || data.name.toLowerCase().replace(/\s+/g, "-"),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return newProduct;
  }

  /** ✏️ Update a product */
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

  /** 🗑️ Delete a product */
  static async deleteProduct(productId: string) {
    if (!productId) throw new BadRequestError("Product ID is required");
    await ProductModel.delete(productId);
    return { success: true, message: "Product deleted successfully" };
  }

  // ───────────────────────────────────────────────
  // ⭐ REVIEWS + RATING SYNC (Product Only)
  // ───────────────────────────────────────────────

  /** ➕ Add a product review and recalc product ratings only */
  static async addReview(data: {
    product_id: string;
    user_id: string;
    rating: number;
    comment?: string;
  }): Promise<IProductReview> {
    const { product_id, user_id, rating, comment } = data;

    if (!product_id || !user_id)
      throw new BadRequestError("Product ID and User ID required");

    if (rating < 1 || rating > 5)
      throw new BadRequestError("Rating must be between 1 and 5");

    const product = await ProductModel.findById(product_id);
    if (!product) throw new NotFoundError("Product not found");

    const existing = await ProductReviewModel.findOne({ user_id, product_id });
    if (existing)
      throw new BadRequestError("You have already reviewed this product");

    const review = await ProductReviewModel.create({
      id: uuidv4(),
      product_id,
      user_id,
      rating,
      comment: comment || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await this.updateProductRatings(product_id);

    return review;
  }

  /** 🔄 Recalculate product ratings (only product itself) */
  static async updateProductRatings(productId: string) {
    const { data: reviews } = await ProductReviewModel.findAll({
      product_id: productId,
    });

    const reviewCount = reviews.length;
    const average =
      reviewCount > 0
        ? parseFloat(
            (
              reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
            ).toFixed(2)
          )
        : 0;

    await ProductModel.update(productId, {
      rating_average: average,
      rating_count: reviewCount,
      review_count: reviewCount,
      updated_at: new Date().toISOString(),
    });

    return { rating_average: average, rating_count: reviewCount };
  }

  /** 📖 Get all reviews for a product */
  static async getReviews(productId: string) {
    if (!productId) throw new BadRequestError("Product ID is required");

    const { data } = await ProductReviewModel.findAll({
      product_id: productId,
    });
    return data.sort(
      (a, b) =>
        new Date(b.created_at ?? "").getTime() -
        new Date(a.created_at ?? "").getTime()
    );
  }

  /** 🗑️ Delete a review and update product ratings only */
  static async deleteReview(reviewId: string) {
    if (!reviewId) throw new BadRequestError("Review ID is required");

    const review = await ProductReviewModel.findById(reviewId);
    if (!review) throw new NotFoundError("Review not found");

    await ProductReviewModel.delete(reviewId);
    await this.updateProductRatings(review.product_id);

    return { success: true, message: "Review deleted successfully" };
  }
}

export default ProductService;
