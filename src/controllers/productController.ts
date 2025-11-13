import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import ProductService from "../services/productsService.js";
import StoreService from "../services/storeService.js";
import {
  BadRequestError,
  NotFoundError,
  UnauthenticatedError,
} from "../utils/errors/customError.js";
import cloudinary from "cloudinary";

interface CustomRequest extends Request {
  user?: {
    userId: string;
    name: string;
    role: string;
  };
}

/**
 * 🧾 GET: /api/v1/products
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
 * 🏬 GET BY STORE OR VENDOR
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
 * 🔎 SEARCH PRODUCTS
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
 * ➕ CREATE PRODUCT
 */
export const createProduct = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to create a product");

  if (req.user.role !== "vendor")
    throw new BadRequestError("Only vendors can create products");

  const data = req.body;

  // Convert numeric fields
  const numericFields = ["price", "discount_price", "stock", "shipping_cost"];
  numericFields.forEach((f) => {
    if (data[f] !== undefined && data[f] !== "") data[f] = Number(data[f]);
  });

  // Parse JSON specs
  if (typeof data.specs === "string") {
    data.specs = JSON.parse(data.specs);
  }

  // Parse comma-separated arrays
  const arrayFields = ["tags", "highlights", "colors", "sizes"];
  arrayFields.forEach((field) => {
    if (typeof data[field] === "string") {
      data[field] = data[field].split(",").map((x: string) => x.trim());
    }
  });

  const product = await ProductService.createProduct(
    {
      ...data,
      vendor_id: req.user.userId,
    },
    req.files as any
  );

  res.status(StatusCodes.CREATED).json({
    status: 1,
    success: true,
    message: "Product created successfully",
    product,
  });
};

/**
 * ➕ CREATE PRODUCT FOR A SPECIFIC STORE
 */
export const createStoreProduct = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to create a product");

  const { store_id } = req.params;
  if (!store_id) throw new BadRequestError("Store ID is required");

  const data = req.body;

  // Convert numeric fields
  const numericFields = ["price", "discount_price", "stock", "shipping_cost"];
  numericFields.forEach((f) => {
    if (data[f] !== undefined && data[f] !== "") data[f] = Number(data[f]);
  });

  // Parse JSON specs
  if (typeof data.specs === "string") {
    data.specs = JSON.parse(data.specs);
  }

  // Parse comma-separated arrays
  const arrayFields = ["tags", "highlights", "colors", "sizes"];
  arrayFields.forEach((field) => {
    if (typeof data[field] === "string") {
      data[field] = data[field].split(",").map((x: string) => x.trim());
    }
  });

  const product = await ProductService.createProductForStore(
    {
      ...data,
      vendor_id: req.user.userId,
      store_id,
    },
    req.files as any
  );

  res.status(StatusCodes.CREATED).json({
    status: 1,
    success: true,
    message: "Product created successfully for store",
    product,
  });
};

/**
 * ✏️ UPDATE PRODUCT
 */
export const updateProduct = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to update a product");

  const { id } = req.params;
  if (!id) throw new BadRequestError("Product ID is required");

  const existing = await ProductService.getProduct(id);
  if (!existing) throw new NotFoundError("Product not found");

  const updates: Record<string, any> = { ...req.body };

  // Convert numeric fields
  const numericFields = ["price", "discount_price", "stock", "shipping_cost"];
  numericFields.forEach((field) => {
    if (updates[field] !== undefined && updates[field] !== "") {
      updates[field] = Number(updates[field]);
    }
  });

  // Parse JSON (specs)
  if (typeof updates.specs === "string") {
    try {
      updates.specs = JSON.parse(updates.specs);
    } catch {
      throw new BadRequestError("Specs must be valid JSON");
    }
  }

  // Parse comma-separated arrays
  const arrayFields = ["tags", "highlights", "colors", "sizes"];
  arrayFields.forEach((field) => {
    if (typeof updates[field] === "string") {
      updates[field] = updates[field].split(",").map((x: string) => x.trim());
    }
  });

  // Forward only raw updates + raw files to the service
  const updated = await ProductService.updateProduct(
    id,
    updates,
    req.files as any
  );

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Product updated successfully",
    product: updated,
  });
};

/**
 * ❌ DELETE PRODUCT
 */
export const deleteProduct = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to delete a product");

  const { id } = req.params;
  if (!id) throw new BadRequestError("Product ID is required");

  const existing = await ProductService.getProduct(id);
  if (!existing) throw new NotFoundError("Product not found");

  // Delete main image
  if (existing.image?.public_id) {
    await cloudinary.v2.uploader.destroy(existing.image.public_id);
  }

  // Delete gallery
  if (existing.gallery?.length) {
    for (const item of existing.gallery) {
      await cloudinary.v2.uploader.destroy(item.public_id);
    }
  }

  const result = await ProductService.deleteProduct(id);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: result.message,
  });
};
