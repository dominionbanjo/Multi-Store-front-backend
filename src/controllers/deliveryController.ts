import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { DeliveryService } from "../services/deliveryService.js";
import { BadRequestError } from "../utils/errors/customError.js";

/** ➕ POST /api/v1/deliveries */
export const createDelivery = async (req: Request, res: Response) => {
  const {
    order_id,
    buyer_id,
    vendor_id,
    address,
    city,
    state,
    country,
    postal_code,
  } = req.body;
  if (!order_id || !buyer_id || !vendor_id || !address)
    throw new BadRequestError("Missing required delivery fields");

  const delivery = await DeliveryService.createDelivery({
    order_id,
    buyer_id,
    vendor_id,
    address,
    city,
    state,
    country,
    postal_code,
  });

  res.status(StatusCodes.CREATED).json({
    status: 1,
    success: true,
    message: "Delivery created successfully",
    delivery,
  });
};

/** 📦 GET /api/v1/deliveries/:id */
export const getDelivery = async (req: Request, res: Response) => {
  const { id } = req.params;
  const delivery = await DeliveryService.getDelivery(id);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Delivery fetched successfully",
    delivery,
  });
};

/** 🚚 PATCH /api/v1/deliveries/:id/status */
export const updateDeliveryStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) throw new BadRequestError("Delivery status is required");

  const result = await DeliveryService.updateStatus(id, status);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: result.message,
  });
};

/** 👷 PATCH /api/v1/deliveries/:id/assign */
export const assignCourier = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { courier_id } = req.body;
  if (!courier_id) throw new BadRequestError("Courier ID required");

  const delivery = await DeliveryService.assignCourier(id, courier_id);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Courier assigned successfully",
    delivery,
  });
};

/** ✅ PATCH /api/v1/deliveries/confirm/:orderId */
export const confirmDelivery = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { code } = req.body;
  if (!code) throw new BadRequestError("Confirmation code required");

  const result = await DeliveryService.confirmDelivery(orderId, code);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: result.message,
  });
};

/** 🧾 PATCH /api/v1/deliveries/:id/proof */
export const uploadProof = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { proof_url } = req.body;
  if (!proof_url) throw new BadRequestError("Proof URL is required");

  const delivery = await DeliveryService.uploadProof(id, proof_url);

  res.status(StatusCodes.OK).json({
    status: 1,
    success: true,
    message: "Proof of delivery uploaded",
    delivery,
  });
};
