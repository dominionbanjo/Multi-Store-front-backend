import { v4 as uuidv4 } from "uuid";
import { ProductModel } from "../config/db/models/ProductModel.js";
import {
  IProductReview,
  ProductReviewModel,
} from "../config/db/models/ReviewModel.js";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";

class ReviewService {
  // ➕ Add a new product review
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

  // 🧮 Sync product rating with review averages
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

  // 🧾 Fetch all reviews for a product
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

  // ❌ Delete a review
  static async deleteReview(reviewId: string) {
    if (!reviewId) throw new BadRequestError("Review ID is required");

    const review = await ProductReviewModel.findById(reviewId);
    if (!review) throw new NotFoundError("Review not found");

    await ProductReviewModel.delete(reviewId);
    await this.updateProductRatings(review.product_id);

    return { success: true, message: "Review deleted successfully" };
  }
}

export default ReviewService;
