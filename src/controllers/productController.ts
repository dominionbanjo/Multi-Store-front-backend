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

  if (result.pagination.total === 0) {
    throw new NotFoundError("No products found");
  }

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
  if (!product) throw new NotFoundError("Product not found");

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
  const { store_id } = req.params;
  const { page, limit } = req.query;

  const result = await ProductService.getProductsByStore({
    store_id,
    page: Number(page) || 1,
    limit: Number(limit) || 20,
  });

  if (result.pagination.total === 0) {
    throw new NotFoundError("No products found for this vendor or store");
  }

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

  if (result.pagination.total === 0) {
    throw new NotFoundError(`No products found for "${q}"`);
  }

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
  if (!data || !data.name || !data.category)
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

  if (!updated) throw new NotFoundError("Product not found");

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
  if (!result) throw new NotFoundError("Product not found or already deleted");

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: result.message,
  });
};
