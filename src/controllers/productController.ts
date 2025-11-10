import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import ProductService from "../services/productsService.js";
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
 * 🧾 GET: /api/v1/products
 * Get all products (supports pagination & filters)
 */
export const getAllProducts = async (req: Request, res: Response) => {
  const { page, limit, ...filters } = req.query;

  const result = await ProductService.getAllProducts(filters as any, {
    page: Number(page) || 1,
    limit: Number(limit) || 20,
  });

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Products retrieved successfully",
    ...result,
  });
};

/**
 * 🔍 GET: /api/v1/products/:idOrSlug
 * Get a single product by ID or slug
 */
export const getProduct = async (req: Request, res: Response) => {
  const { idOrSlug } = req.params;
  if (!idOrSlug) throw new BadRequestError("Product ID or slug is required");

  const product = await ProductService.getProduct(idOrSlug);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Product retrieved successfully",
    product,
  });
};

/**
 * 🏬 GET: /api/v1/products/store/:store_id or /vendor/:vendor_id
 * Get products by vendor or store
 */
export const getByVendorOrStore = async (req: Request, res: Response) => {
  const { vendor_id, store_id } = req.params;
  const { page, limit } = req.query;

  const result = await ProductService.getByVendorOrStore({
    vendor_id,
    store_id,
    page: Number(page) || 1,
    limit: Number(limit) || 20,
  });

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Products retrieved successfully",
    ...result,
  });
};

/**
 * 🔎 GET: /api/v1/products/search?q=keyword
 * Search products by name
 */
export const searchProducts = async (req: Request, res: Response) => {
  const { q, page, limit } = req.query;
  if (!q) throw new BadRequestError("Search query is required");

  const result = await ProductService.search(
    String(q),
    Number(page) || 1,
    Number(limit) || 20
  );

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Search results retrieved successfully",
    ...result,
  });
};

/**
 * ➕ POST: /api/v1/products
 * Create new product (vendors only)
 */
export const createProduct = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to create a product");

  if (req.user.role !== "vendor")
    throw new BadRequestError("Only vendors can create products");

  const data = req.body;
  if (!data || !data.name || !data.category_id)
    throw new BadRequestError("Missing required fields");

  const product = await ProductService.createProduct({
    ...data,
    vendor_id: req.user.userId,
  });

  res.status(StatusCodes.CREATED).json({
    status: 1,
    success: true,
    message: "Product created successfully",
    product,
  });
};

/**
 * ✏️ PATCH: /api/v1/products/:id
 * Update a product (vendor only)
 */
export const updateProduct = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to update a product");

  const { id } = req.params;
  if (!id) throw new BadRequestError("Product ID is required");

  const updates = req.body;
  const updated = await ProductService.updateProduct(id, updates);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Product updated successfully",
    product: updated,
  });
};

/**
 * ❌ DELETE: /api/v1/products/:id
 * Delete a product (vendor only)
 */
export const deleteProduct = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to delete a product");

  const { id } = req.params;
  if (!id) throw new BadRequestError("Product ID is required");

  const result = await ProductService.deleteProduct(id);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: result.message,
  });
};

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
 * 📖 GET: /api/v1/products/:product_id/reviews
 * Get all reviews for a product
 */
export const getReviews = async (req: Request, res: Response) => {
  const { product_id } = req.params;
  if (!product_id) throw new BadRequestError("Product ID is required");

  const reviews = await ProductService.getReviews(product_id);

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

  const result = await ProductService.deleteReview(id);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: result.message,
  });
};
