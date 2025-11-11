import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { OrderService } from "../services/orderService.js";
import {
  UnauthenticatedError,
  BadRequestError,
} from "../utils/errors/customError.js";
import { verifyBankAccount } from "../utils/payment/paystack.js";

interface CustomRequest extends Request {
  user?: {
    userId: string;
    name: string;
    role: string;
  };
}

/** ➕ POST /api/v1/orders */
export const createOrder = async (req: CustomRequest, res: Response) => {
  if (!req.user)
    throw new UnauthenticatedError("Please login to place an order");

  const { vendor_id, store_id, subtotal, shipping_fee, tax, total, notes } =
    req.body;
  if (!vendor_id || !subtotal || !total)
    throw new BadRequestError("Missing required fields");

  const order = await OrderService.createOrder({
    buyer_id: req.user.userId,
    vendor_id,
    store_id,
    subtotal,
    shipping_fee,
    tax,
    total,
    notes,
  });

  res.status(StatusCodes.CREATED).json({
    status: 1,
    success: true,
    message: "Order created successfully",
    order,
  });
};

/** 📄 GET /api/v1/orders/:id */
export const getOrder = async (req: CustomRequest, res: Response) => {
  const { id } = req.params;
  const order = await OrderService.getOrder(id);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Order fetched successfully",
    order,
  });
};

/** 📜 GET /api/v1/orders */
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

/** 🔄 PATCH /api/v1/orders/:id/status */
export const updateOrderStatus = async (req: CustomRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const updated = await OrderService.updateOrderStatus(id, status);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Order status updated",
    order: updated,
  });
};

/** 🧾 POST /api/v1/orders/paystack/initialize */
export const createPaystackOrder = async (
  req: CustomRequest,
  res: Response
) => {
  if (!req.user) throw new UnauthenticatedError("Login required");

  const { vendor_id, store_id, subtotal, shipping_fee, total, email } =
    req.body;

  const result = await OrderService.createOrderWithPaystack({
    buyer_id: req.user.userId,
    vendor_id,
    store_id,
    subtotal,
    shipping_fee,
    total,
    email,
  });

  res.status(StatusCodes.CREATED).json({
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
  if (!reference) throw new BadRequestError("Reference required");

  const result = await OrderService.verifyPayment(reference as string);
  res.status(StatusCodes.OK).json(result);
};

/** ❌ DELETE /api/v1/orders/:id */
export const cancelOrder = async (req: CustomRequest, res: Response) => {
  const { id } = req.params;
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
