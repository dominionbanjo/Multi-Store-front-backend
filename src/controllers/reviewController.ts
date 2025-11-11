import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import ReviewService from "../services/reviewService.js";
import {
  BadRequestError,
  NotFoundError,
  UnauthenticatedError,
} from "../utils/errors/customError.js";

interface CustomRequest extends Request {
  user?: {
    userId: string;
    name: string;
    role: string;
  };
}

/**
 * ⭐ POST: /api/v1/products/:product_id/reviews
 * Add a review for a product
 */
export const addReview = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to review a product");

  const { product_id } = req.params;
  const { rating, comment } = req.body;

  if (!rating) throw new BadRequestError("Rating is required");

  const review = await ReviewService.addReview({
    product_id,
    user_id: req.user.userId,
    rating,
    comment,
  });

  res.status(StatusCodes.CREATED).json({
    status: 1,
    success: true,
    message: "Review added successfully",
    review,
  });
};

/**
 * 📖 GET: /api/v1/products/:product_id/reviews
 * Get all reviews for a product
 */
export const getReviews = async (req: Request, res: Response) => {
  const { product_id } = req.params;
  if (!product_id) throw new BadRequestError("Product ID is required");

  const reviews = await ReviewService.getReviews(product_id);
  if (!reviews || reviews.length === 0)
    throw new NotFoundError("No reviews found for this product");

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Product reviews retrieved successfully",
    reviews,
  });
};

/**
 * 🗑️ DELETE: /api/v1/products/reviews/:id
 * Delete a review (user only deletes own review)
 */
export const deleteReview = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to delete a review");

  const { id } = req.params;
  if (!id) throw new BadRequestError("Review ID is required");

  const result = await ReviewService.deleteReview(id);
  if (!result) throw new NotFoundError("Review not found or already deleted");

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: result.message,
  });
};
