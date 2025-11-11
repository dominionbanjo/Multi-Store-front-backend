import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import StoreService from "../services/storeService.js";
import {
  BadRequestError,
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
 * ➕ POST: /api/v1/stores
 * Create a new store (vendor only)
 */
export const createStore = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to create a store");

  if (req.user.role !== "vendor")
    throw new BadRequestError("Only vendors can create stores");

  const data = req.body;
  if (!data.store_name || !data.username)
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
  const { idOrUsername } = req.params;
  if (!idOrUsername) throw new BadRequestError("Store ID or username required");

  const store = await StoreService.getStore(idOrUsername);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Store retrieved successfully",
    store,
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
 * 🧭 GET: /api/v1/stores/:store_id/products
 * Get all products for a store
 */
export const getStoreProducts = async (req: Request, res: Response) => {
  const { store_id } = req.params;
  const { page, limit } = req.query;

  const result = await StoreService.getStoreProducts(
    store_id,
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
  if (!req.user)
    throw new UnauthenticatedError("Please login to update a store");

  const { id } = req.params;
  if (!id) throw new BadRequestError("Store ID is required");

  const updated = await StoreService.updateStore(id, req.body);

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
