import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import StoreService from "../services/storeService.js";
import {
  BadRequestError,
  NotFoundError,
  UnauthenticatedError,
} from "../utils/errors/customError.js";
import cloudinary from "cloudinary";
import { formatImage } from "../utils/images/multer.js";

interface CustomRequest extends Request {
  user?: {
    userId: string;
    name: string;
    role: string;
  };
}

/**
 * ➕ POST: /api/v1/stores
 * Create a new store (vendor only)
 */
export const createStore = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to create a store");

  if (req.user.role !== "vendor")
    throw new BadRequestError("Only vendors can create stores");

  const data = req.body;
  if (!data.store_name)
    throw new BadRequestError("Missing store_name or username");

  const store = await StoreService.createStore({
    ...data,
    user_id: req.user.userId,
  });

  res.status(StatusCodes.CREATED).json({
    status: 1,
    success: true,
    message: "Store created successfully",
    store,
  });
};

/**
 * 📄 GET: /api/v1/stores/:idOrUsername
 * Get store details by ID or username
 */
export const getStore = async (req: Request, res: Response) => {
  const { idOrSlug: identifier } = req.params;

  if (!identifier || identifier.trim() === "") {
    throw new BadRequestError("Store ID or username is required");
  }

  const store = await StoreService.getStore(identifier);

  if (!store) {
    throw new NotFoundError(`Store  not found`);
  }

  return res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Store retrieved successfully",
    data: store,
  });
};

/**
 * 🧾 GET: /api/v1/stores
 * Get all stores (paginated)
 */
export const getAllStores = async (req: Request, res: Response) => {
  const { page, limit } = req.query;

  const result = await StoreService.getAllStores(
    Number(page) || 1,
    Number(limit) || 20
  );

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Stores retrieved successfully",
    ...result,
  });
};

/**
 * 🧾 GET: /api/v1/admin/stores
 * Get all stores (admin view — full details)
 */
export const getAllStoresAdmin = async (req: Request, res: Response) => {
  const { page, limit } = req.query;

  const result = await StoreService.getAllStoresAdmin(
    Number(page) || 1,
    Number(limit) || 20
  );

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "All stores retrieved successfully (admin view)",
    ...result,
  });
};

/**
 * 🧭 GET: /api/v1/stores/:store_id/products
 * Get all products for a store
 */
export const getStoreProducts = async (req: Request, res: Response) => {
  const { idOrSlug } = req.params;
  const { page, limit } = req.query;

  if (!idOrSlug || idOrSlug.trim() === "")
    throw new BadRequestError("Store ID or slug is required");

  const result = await StoreService.getStoreProducts(
    idOrSlug,
    Number(page) || 1,
    Number(limit) || 20
  );

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Store products retrieved successfully",
    ...result,
  });
};

/**
 * ✏️ PATCH: /api/v1/stores/:id
 * Update store info (vendor only)
 */

export const updateStore = async (req: CustomRequest, res: Response) => {
  const { id: storeId } = req.params;
  if (!storeId) throw new BadRequestError("Store ID is required");

  if (!req.user)
    throw new UnauthenticatedError("Please login to update your store");

  const updateData: Record<string, any> = { ...req.body };

  // ✅ Parse address JSON if passed as string
  if (updateData.address && typeof updateData.address === "string") {
    try {
      updateData.address = JSON.parse(updateData.address);
    } catch {
      throw new BadRequestError("Invalid address JSON format");
    }
  }

  // ✅ Get current store record
  const existingStore = await StoreService.getStore(storeId);

  const files = req.files as {
    logo?: Express.Multer.File[];
    cover_image?: Express.Multer.File[];
  };

  const logoFile = files?.logo?.[0];
  const coverFile = files?.cover_image?.[0];

  if (logoFile) {
    const fileStr = formatImage(logoFile);
    const uploaded = await cloudinary.v2.uploader.upload(fileStr, {
      folder: "easystore/stores/logos",
      use_filename: true,
    });

    updateData.logo = uploaded.secure_url;
    updateData.logo_public_id = uploaded.public_id;

    // Delete old logo
    if (existingStore.logo_public_id) {
      await cloudinary.v2.uploader.destroy(existingStore.logo_public_id);
    }
  }

  if (coverFile) {
    const fileStr = formatImage(coverFile);
    const uploaded = await cloudinary.v2.uploader.upload(fileStr, {
      folder: "easystore/stores/covers",
      use_filename: true,
    });

    updateData.cover_image = uploaded.secure_url;
    updateData.cover_image_public_id = uploaded.public_id;

    // Delete old cover image
    if (existingStore.cover_image_public_id) {
      await cloudinary.v2.uploader.destroy(existingStore.cover_image_public_id);
    }
  }

  // ✅ Update store record
  const updated = await StoreService.updateStore(storeId, updateData);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Store updated successfully",
    store: updated,
  });
};

/**
 * ❌ DELETE: /api/v1/stores/:id
 * Delete a store (vendor only)
 */
export const deleteStore = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to delete a store");

  const { id } = req.params;
  if (!id) throw new BadRequestError("Store ID is required");

  const result = await StoreService.deleteStore(id);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: result.message,
  });
};

export const checkStoreNameAvailability = async (
  req: Request,
  res: Response
) => {
  const { store_name } = req.query;

  if (!store_name || typeof store_name !== "string") {
    throw new BadRequestError("store_name query parameter is required");
  }

  const exists = await StoreService.storeNameExists(store_name);

  return res.status(StatusCodes.OK).json({
    status: 1,
    available: !exists,
    exists,
    store_name,
  });
};

/** 📊 GET ANALYTICS FOR A STORE */
export const getStoreAnalytics = async (req: CustomRequest, res: Response) => {
  const { store_id } = req.params;
  const user_id = req.user?.userId!;
  const role = req.user?.role!;

  if (!store_id) {
    throw new BadRequestError("store_id parameter is required");
  }

  const analytics = await StoreService.getAnalytics(store_id, user_id, role);

  return res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    analytics,
  });
};
/** 🏦 POST: /api/v1/stores/:id/bank */
export const registerBankAccount = async (
  req: CustomRequest,
  res: Response
) => {
  if (!req.user) throw new UnauthenticatedError("Please login");

  const { id } = req.params;
  const { bank_code, account_number, settlement_email } = req.body;
  if (!bank_code || !account_number)
    throw new BadRequestError("Bank code and account number are required");

  const result = await StoreService.registerBankAccount(
    id,
    bank_code,
    account_number,
    settlement_email
  );

  res.status(StatusCodes.CREATED).json(result);
};

/** ✏️ PATCH: /api/v1/stores/:id/bank */
export const updateBankAccount = async (req: CustomRequest, res: Response) => {
  if (!req.user) throw new UnauthenticatedError("Please login");

  const { id } = req.params;
  const result = await StoreService.updateBankAccount(id, req.body);

  res.status(StatusCodes.OK).json(result);
};

/** ❌ DELETE: /api/v1/stores/:id/bank */
export const deleteBankAccount = async (req: CustomRequest, res: Response) => {
  if (!req.user) throw new UnauthenticatedError("Please login");

  const { id } = req.params;
  const result = await StoreService.deleteBankAccount(id);

  res.status(StatusCodes.OK).json(result);
};
