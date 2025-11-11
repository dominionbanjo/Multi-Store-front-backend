import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import ProductService from "../services/productsService.js";
import {
  BadRequestError,
  UnauthenticatedError,
  NotFoundError,
} from "../utils/errors/customError.js";

interface CustomRequest extends Request {
  user?: {
    userId: string;
    name: string;
    role: string;
  };
}

/**
 * 📖 GET: /api/v1/reviews/:product_id
 * Get all reviews for a specific product
 */
export const getProductReviews = async (req: Request, res: Response) => {
  const { product_id } = req.params;
  if (!product_id) throw new BadRequestError("Product ID is required");

  const reviews = await ProductService.getReviews(product_id);
  if (reviews.length < 1)
    throw new NotFoundError("No reviews found for this product ");

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Product reviews retrieved successfully",
    reviews,
  });
};

/**
 * ➕ POST: /api/v1/reviews/:product_id
 * Add a new review for a product (auth required)
 */
export const addReview = async (req: CustomRequest, res: Response) => {
  if (!req.user) throw new UnauthenticatedError("Please login to add a review");

  const { product_id } = req.params;
  const { rating, comment } = req.body;

  if (!product_id || !rating)
    throw new BadRequestError("Product ID and rating are required");

  const review = await ProductService.addReview({
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
 * ❌ DELETE: /api/v1/reviews/:id
 * Delete a review (only the user who wrote it or an admin)
 */
export const deleteReview = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to delete a review");

  const { id } = req.params;
  if (!id) throw new BadRequestError("Review ID is required");

  const review = await ProductService.deleteReview(id);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: review.message,
  });
};
