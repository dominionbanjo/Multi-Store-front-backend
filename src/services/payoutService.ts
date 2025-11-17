// services/payoutService.ts
import { v4 as uuidv4 } from "uuid";
import {
  PayoutModel,
  IPayout,
  PayoutStatus,
} from "../config/db/models/PayoutModel.js";
import { NotFoundError, BadRequestError } from "../utils/errors/customError.js";
import { TransactionModel } from "../config/db/models/TransactionModel.js";

/* ----------------------------------------- *
 *  Paystack Transfer Response Type
 * ----------------------------------------- */
export interface IPaystackTransferData {
  id: number;
  amount: number;
  currency: string;
  source: string;
  reason: string | null;
  status: string;
  transfer_code: string;
  reference: string;
  integration: number;
  recipient: number | string;
  domain: string;
  created_at: string;
  updated_at: string;
  failures?: any;
}

/* ----------------------------------------- *
 *  Payout Creation Input Type
 * ----------------------------------------- */
export interface ICreatePendingPayout {
  order_id?: string | null;
  escrow_id?: string | null;
  recipient_code: string;
  amount: number;
  currency?: string;
  transfer_data?: IPaystackTransferData | null;
}

/* ----------------------------------------- *
 *  PayoutService With Type Safety
 * ----------------------------------------- */
class PayoutService {
  /* ----------------------- CREATE PENDING PAYOUT ----------------------- */
  static async createPendingPayout({
    order_id = null,
    escrow_id = null,
    recipient_code,
    amount,
    currency = "NGN",
    transfer_data = null,
  }: ICreatePendingPayout): Promise<IPayout> {
    if (!recipient_code) throw new BadRequestError("recipient_code required");
    if (!amount || amount <= 0) throw new BadRequestError("invalid amount");

    const payout = await PayoutModel.create({
      id: uuidv4(),
      order_id,
      escrow_id,
      transfer_code: transfer_data?.transfer_code ?? null,
      transfer_reference: transfer_data?.reference ?? null,
      recipient_code,
      amount,
      currency,
      status: "pending",
      metadata: transfer_data ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await TransactionModel.create({
      id: uuidv4(),
      order_id,
      escrow_id,
      vendor_id: null,
      user_id: null,
      type: "payout",
      amount,
      currency,
      reference:
        transfer_data?.transfer_code ?? transfer_data?.reference ?? null,
      description: "Payout initiated (pending)",
      status: "pending",
      metadata: transfer_data ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return payout;
  }

  /* ----------------------- FIND BY TRANSFER CODE ----------------------- */
  static async findByTransferCode(
    transfer_code: string
  ): Promise<IPayout | null> {
    if (!transfer_code) throw new BadRequestError("transfer_code required");
    return await PayoutModel.findOne({ transfer_code });
  }

  /* ----------------------- MARK SUCCESS ----------------------- */
  static async markSuccess(
    transfer_code: string,
    payload: IPaystackTransferData
  ): Promise<IPayout> {
    const payout = await this.findByTransferCode(transfer_code);

    if (!payout) throw new NotFoundError("Payout not found");
    if (payout.status === "success") return payout; // Idempotent

    const updated = await PayoutModel.update(payout.id, {
      status: "success" as PayoutStatus,
      metadata: { ...(payout.metadata || {}), webhook: payload },
      updated_at: new Date().toISOString(),
    });

    await TransactionModel.create({
      id: uuidv4(),
      order_id: payout.order_id,
      escrow_id: payout.escrow_id,
      type: "payout",
      amount: payout.amount,
      currency: payout.currency,
      reference: transfer_code,
      description: "Payout succeeded",
      status: "success",
      metadata: payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return updated;
  }

  /* ----------------------- MARK FAILED ----------------------- */
  static async markFailed(
    transfer_code: string,
    payload: IPaystackTransferData
  ): Promise<IPayout> {
    const payout = await this.findByTransferCode(transfer_code);
    if (!payout) throw new NotFoundError("Payout not found");
    if (payout.status === "failed") return payout;

    const updated = await PayoutModel.update(payout.id, {
      status: "failed" as PayoutStatus,
      metadata: { ...(payout.metadata || {}), webhook: payload },
      updated_at: new Date().toISOString(),
    });

    await TransactionModel.create({
      id: uuidv4(),
      order_id: payout.order_id,
      escrow_id: payout.escrow_id,
      type: "payout",
      amount: payout.amount,
      currency: payout.currency,
      reference: transfer_code,
      description: "Payout failed",
      status: "failed",
      metadata: payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return updated;
  }

  /* ----------------------- MARK REVERSED ----------------------- */
  static async markReversed(
    transfer_code: string,
    payload: IPaystackTransferData
  ): Promise<IPayout> {
    const payout = await this.findByTransferCode(transfer_code);
    if (!payout) throw new NotFoundError("Payout not found");
    if (payout.status === "reversed") return payout;

    const updated = await PayoutModel.update(payout.id, {
      status: "reversed" as PayoutStatus,
      metadata: { ...(payout.metadata || {}), webhook: payload },
      updated_at: new Date().toISOString(),
    });

    await TransactionModel.create({
      id: uuidv4(),
      order_id: payout.order_id,
      escrow_id: payout.escrow_id,
      type: "payout",
      amount: payout.amount,
      currency: payout.currency,
      reference: transfer_code,
      description: "Payout reversed",
      status: "reversed",
      metadata: payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return updated;
  }
}

export default PayoutService;
