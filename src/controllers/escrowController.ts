import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { EscrowService } from "../services/escrowService.js";
import { BadRequestError } from "../utils/errors/customError.js";

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
export const releaseEscrow = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { code } = req.body;
  if (!code) throw new BadRequestError("Release code is required");

  const result = await EscrowService.releaseEscrow(orderId, code);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: result.message,
  });
};

/** 💸 PATCH /api/v1/escrow/:id/refund */
export const refundEscrow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await EscrowService.refundEscrow(id);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: result.message,
  });
};
