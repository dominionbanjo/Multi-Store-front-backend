import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { OrderService } from "../services/orderService.js";
import {
  UnauthenticatedError,
  BadRequestError,
} from "../utils/errors/customError.js";
import { verifyBankAccount } from "../utils/payment/paystack.js";
import { ICartItem } from "../config/db/models/CartModel.js";
import { StoreModel, UserModel } from "../config/db/models/index.js";

interface CustomRequest extends Request {
  user?: {
    userId: string;
    name: string;
    role: string;
  };
}

/* -------------------------------------------------------------------------- */
/*                        1. CREATE OFFLINE ORDER (MULTI-VENDOR)              */
/* -------------------------------------------------------------------------- */
export const createOrder = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to place an order");

  const { tax, notes, order_items, payment_method } = req.body;

  if (payment_method !== "offline")
    throw new BadRequestError("This endpoint only supports offline orders");

  if (!Array.isArray(order_items) || order_items.length === 0)
    throw new BadRequestError("order_items must be a non-empty array");

  const result = await OrderService.createOrder({
    buyer_id: req.user.userId,
    tax: typeof tax === "number" ? tax : undefined,
    notes,
    order_items: order_items as ICartItem[],
    payment_method: "offline",
  });

  res.status(StatusCodes.CREATED).json({
    status: 1,
    success: true,
    message: "Offline order(s) created",
    orders: result.successfulOrders.map((o) => o.order), // extract pure orders
  });
};

/* -------------------------------------------------------------------------- */
/*                     2. MARK OFFLINE ORDER PAID                              */
/* -------------------------------------------------------------------------- */
export const fulfillOfflineDeliveryController = async (
  req: CustomRequest,
  res: Response
) => {
  if (!req.user) throw new UnauthenticatedError("Please login");

  const { id } = req.params;
  if (!id) throw new BadRequestError("Order id is required");

  const result = await OrderService.fulfillOfflineDelivery(id, req.user.userId);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: result.message,
    order: result.order,
  });
};

/* -------------------------------------------------------------------------- */
/*    3. CREATE ORDER + INITIALIZE PAYSTACK PAYMENT (ONLINE, MULTI-VENDOR)    */
/* -------------------------------------------------------------------------- */
export const createPaystackOrder = async (
  req: CustomRequest,
  res: Response
) => {
  if (!req.user) {
    throw new UnauthenticatedError("Login required");
  }
  const { email, order_items } = req.body;

  if (!email) throw new BadRequestError("email is required");
  if (!Array.isArray(order_items) || order_items.length === 0)
    throw new BadRequestError("order_items must be a non-empty array");

  // -------------------------------------------------
  // 🔐 1. BUYER MUST HAVE PAYOUT VERIFIED
  // -------------------------------------------------
  const buyer = await UserModel.findById(req.user.userId);
  if (!buyer) throw new BadRequestError("Buyer not found");

  if (!buyer.payout_verified) {
    throw new BadRequestError(
      "You must add your bank account details before you can place online orders"
    );
  }

  // -------------------------------------------------
  // 📍 2. BUYER MUST HAVE A COMPLETE ADDRESS
  // -------------------------------------------------
  if (!buyer.address) {
    throw new BadRequestError(
      "Please add your delivery address in your profile before placing an online order."
    );
  }

  // -------------------------------------------------
  // 🔥 3. CREATE MULTI–VENDOR PAYSTACK ORDER
  // -------------------------------------------------
  const result = await OrderService.createOrderWithPaystack({
    buyer_id: req.user.userId,
    email,
    order_items: order_items as ICartItem[],
  });

  res.status(StatusCodes.CREATED).json({
    status: 1,
    success: true,
    message: "Order(s) processed",
    successfulOrders: result.successfulOrders, // good vendor orders
    failedVendors: result.failedVendors, // vendors that failed
  });
};
/* -------------------------------------------------------------------------- */
/*                        4. VERIFY PAYSTACK PAYMENT                           */
/* -------------------------------------------------------------------------- */
export const verifyPaystackOrder = async (
  req: CustomRequest,
  res: Response
) => {
  const { reference } = req.query;

  if (!reference || typeof reference !== "string")
    throw new BadRequestError("Reference required");

  const result = await OrderService.verifyPayment(reference);

  res.status(StatusCodes.OK).json(result);
};

/* -------------------------------------------------------------------------- */
/*                             5. GET ONE ORDER                                */
/* -------------------------------------------------------------------------- */
export const getOrder = async (req: CustomRequest, res: Response) => {
  const { id } = req.params;
  if (!id) throw new BadRequestError("Order id required");

  const order = await OrderService.getOrder(id);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Order fetched successfully",
    order,
  });
};

/* -------------------------------------------------------------------------- */
/*                     6. GET ORDERS FOR CUSTOMER                             */
/* -------------------------------------------------------------------------- */
export const getUserOrders = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to view your orders");

  const orders = await OrderService.getOrdersByUser(req.user.userId);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Orders retrieved successfully",
    orders,
  });
};

/* -------------------------------------------------------------------------- */
/*                   7. GET ALL ORDERS FOR A VENDOR                           */
/* -------------------------------------------------------------------------- */
export const getVendorOrders = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to view vendor orders");

  const orders = await OrderService.getOrdersByVendor(req.user.userId);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Vendor orders retrieved successfully",
    orders,
  });
};

/* -------------------------------------------------------------------------- */
/*                       8. UPDATE ORDER STATUS                                */
/* -------------------------------------------------------------------------- */
export const updateOrderStatus = async (req: CustomRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!id) throw new BadRequestError("Order id required");
  if (!status) throw new BadRequestError("Status is required");

  const updated = await OrderService.updateOrderStatus(id, status);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Order status updated successfully",
    order: updated,
  });
};

/* -------------------------------------------------------------------------- */
/*                              9. CANCEL ORDER                                */
/* -------------------------------------------------------------------------- */
export const cancelOrder = async (req: CustomRequest, res: Response) => {
  const { id } = req.params;
  const requestedBy = req.user?.userId;

  if (!id) throw new BadRequestError("Order id required");
  if (!requestedBy) throw new BadRequestError("Unauthorized request");

  const result = await OrderService.cancelOrder(id, requestedBy);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    idempotent: result.idempotent ?? false,
    message: result.message,
  });
};

/* -------------------------------------------------------------------------- */
/*                    10. VERIFY BANK ACCOUNT (PAYSTACK)                      */
/* -------------------------------------------------------------------------- */
export const verifyBankAccountController = async (
  req: Request,
  res: Response
) => {
  const { account_number, bank_code } = req.body;

  if (!account_number || !bank_code)
    throw new BadRequestError("Account number and bank code are required");

  const verified = await verifyBankAccount(account_number, bank_code);

  if (!verified?.account_name)
    throw new BadRequestError(
      "Could not verify account. Please check details."
    );

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Account verified successfully",
    data: {
      account_name: verified.account_name,
      account_number: verified.account_number,
      bank_name: verified.bank_name || "Unknown Bank",
    },
  });
};
