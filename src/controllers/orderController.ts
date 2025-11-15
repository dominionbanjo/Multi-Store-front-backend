import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { OrderService } from "../services/orderService.js";
import {
  UnauthenticatedError,
  BadRequestError,
} from "../utils/errors/customError.js";
import { verifyBankAccount } from "../utils/payment/paystack.js";
import { ICartItem } from "../config/db/models/CartModel.js";

interface CustomRequest extends Request {
  user?: {
    userId: string;
    name: string;
    role: string;
  };
}

/** ➕ POST /api/v1/orders
 *  Create an OFFLINE order. This endpoint expects payment_method === "offline"
 */
export const createOrder = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to place an order");

  const {
    vendor_id,
    store_id,
    subtotal,
    shipping_fee = 0,
    tax = null,
    total,
    notes = null,
    order_items,
    payment_method,
  } = req.body;

  if (!vendor_id || subtotal === undefined || total === undefined)
    throw new BadRequestError("Missing required fields");

  // Explicit payment_method required and must be 'offline' for this route
  if (payment_method !== "offline")
    throw new BadRequestError(
      "This endpoint only creates offline orders (payment_method = 'offline')"
    );

  if (!Array.isArray(order_items) || order_items.length === 0)
    throw new BadRequestError("order_items must be a non-empty array");

  const order = await OrderService.createOrder({
    buyer_id: req.user.userId,
    vendor_id,
    store_id,
    subtotal: Number(subtotal),
    shipping_fee: Number(shipping_fee),
    tax: tax === null ? null : Number(tax),
    total: Number(total),
    notes,
    order_items: order_items as ICartItem[],
    payment_method: "offline",
  });

  res.status(StatusCodes.CREATED).json({
    status: 1,
    success: true,
    message: "Offline order created successfully",
    order,
  });
};

/** 🧾 POST /api/v1/orders/:id/mark-paid-offline
 *  Mark an offline order as paid (vendor/admin). Route should be protected with authorizePermissions.
 */
export const markOrderPaidOfflineController = async (
  req: CustomRequest,
  res: Response
) => {
  if (!req.user) throw new UnauthenticatedError("Please login");

  const { id } = req.params;
  if (!id) throw new BadRequestError("Order id is required");

  const result = await OrderService.markOrderPaidOffline(id);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: result.message,
    order: result.order,
  });
};

/** 🧾 POST /api/v1/orders/paystack/initialize
 *  Create order + initialize Paystack payment (online)
 */
export const createPaystackOrder = async (
  req: CustomRequest,
  res: Response
) => {
  if (!req.user) throw new UnauthenticatedError("Login required");

  const {
    vendor_id,
    store_id,
    subtotal,
    shipping_fee = 0,
    total,
    email,
    order_items,
  } = req.body;

  if (!vendor_id || subtotal === undefined || total === undefined || !email)
    throw new BadRequestError("Missing required fields");

  if (!Array.isArray(order_items) || order_items.length === 0)
    throw new BadRequestError("order_items must be a non-empty array");

  const result = await OrderService.createOrderWithPaystack({
    buyer_id: req.user.userId,
    vendor_id,
    store_id,
    subtotal: Number(subtotal),
    shipping_fee: Number(shipping_fee),
    total: Number(total),
    email,
    order_items: order_items as ICartItem[],
  });

  res.status(StatusCodes.CREATED).json({
    status: 1,
    success: true,
    message: "Order created, proceed to payment",
    order: result.order,
    paymentUrl: result.paymentUrl,
  });
};

/** ✅ GET /api/v1/orders/paystack/verify?reference=<ref> */
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

/** 📄 GET /api/v1/orders/:id */
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

/** 📜 GET /api/v1/orders
 *  Get orders for current user (buyer)
 */
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

/** 📜 GET /api/v1/orders/vendor
 *  Get orders for vendor (current user). Route should be protected so only vendor/admin can call it.
 */
export const getVendorOrders = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to view vendor orders");

  const vendor_id = req.user.userId;
  const orders = await OrderService.getOrdersByVendor(vendor_id);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Vendor orders retrieved successfully",
    orders,
  });
};

/** 🔄 PATCH /api/v1/orders/:id/status
 *  Update order status (admin/vendor only)
 */
export const updateOrderStatus = async (req: CustomRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!id) throw new BadRequestError("Order id required");
  if (!status) throw new BadRequestError("Status is required");

  const updated = await OrderService.updateOrderStatus(id, status);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Order status updated",
    order: updated,
  });
};

/** ❌ DELETE /api/v1/orders/:id
 *  Cancel order
 */
export const cancelOrder = async (req: CustomRequest, res: Response) => {
  const { id } = req.params;
  if (!id) throw new BadRequestError("Order id required");

  const result = await OrderService.cancelOrder(id);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: result.message,
  });
};

/** 🏦 POST /api/v1/orders/paystack/verify-bank
 * Verify a bank account via Paystack (for frontend confirmation)
 */
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
