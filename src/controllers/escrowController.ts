import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { EscrowService } from "../services/escrowService.js";
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

/** 📄 GET /api/v1/escrow/:id */
export const getEscrow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const escrow = await EscrowService.getEscrow(id);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Escrow fetched successfully",
    escrow,
  });
};

/** 💳 PATCH /api/v1/escrow/:id/fund */
export const fundEscrow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = await EscrowService.fundEscrow(id);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Escrow funded successfully",
    escrow: updated,
  });
};

/** 📦 PATCH /api/v1/escrow/order/:orderId/delivered */
export const markDelivered = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const updated = await EscrowService.markDelivered(orderId);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Delivery marked and escrow updated",
    escrow: updated,
  });
};

/** 🔓 PATCH /api/v1/escrow/release/:orderId */
export const releaseEscrow = async (req: CustomRequest, res: Response) => {
  const { orderId } = req.params;
  const { code } = req.body;

  // Validate required fields
  if (!orderId) {
    throw new BadRequestError("Order ID is required");
  }

  if (!code) {
    throw new BadRequestError("Release code is required");
  }

  // Ensure user is authenticated
  const userId = req.user?.userId;
  if (!userId) {
    throw new BadRequestError("Unauthorized release");
  }

  // Call service layer
  const result = await EscrowService.releaseEscrow(orderId, code, userId);

  return res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: result.message,
  });
};

/** 💸 PATCH /api/v1/escrow/:id/refund */
export const refundEscrow = async (req: CustomRequest, res: Response) => {
  const { id } = req.params;

  // must be logged in
  if (!req.user) {
    throw new UnauthenticatedError("Please login");
  }

  const requestedBy = req.user.userId;

  if (!id) throw new BadRequestError("Escrow ID is required");

  const result = await EscrowService.refundEscrow(id, requestedBy);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    idempotent: result.idempotent ?? false,
    message: result.message,
    reference: result.payout_reference ?? null,
  });
};
