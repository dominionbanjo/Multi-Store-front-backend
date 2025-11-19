import { v4 as uuidv4 } from "uuid";
import {
  EscrowModel,
  IEscrow,
  EscrowStatus,
} from "../config/db/models/EscrowModel.js";
import { OrderModel, OrderStatus } from "../config/db/models/OrderModel.js";
import { StoreModel, IStoreCustomer } from "../config/db/models/StoreModel.js";
import { UserModel } from "../config/db/models/UserModel.js";
import { TransactionModel } from "../config/db/models/TransactionModel.js";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";
import { initiateTransfer } from "../utils/payment/paystack.js";
import { EscrowMailService } from "../utils/mails/EscrowMailService.js";
import PayoutService from "./payoutService.js";
import StoreService from "./storeService.js";
import { PayoutModel } from "../config/db/models/index.js";
import { ServiceCache } from "../utils/helpers/ServiceCache.js";

/**
 * 💰 Escrow Service (Idempotent + Cached)
 */
export class EscrowService {
  /** ➕ Create escrow record when order is created (idempotent + cached) */
  static async createEscrow(data: {
    order_id: string;
    buyer_id: string;
    vendor_id: string;
    amount: number;
  }): Promise<IEscrow> {
    if (!data.order_id || !data.buyer_id || !data.vendor_id)
      throw new BadRequestError("Missing escrow fields");

    const orderKey = ServiceCache.key("escrow", "order", data.order_id);

    // IDEMPOTENT – first check cache
    const cached = await ServiceCache.get<IEscrow>(orderKey);
    if (cached) return cached;

    // IDEMPOTENT – check DB
    const existing = await EscrowModel.findOne({ order_id: data.order_id });
    if (existing) {
      await ServiceCache.set(orderKey, existing);
      await ServiceCache.set(
        ServiceCache.key("escrow", "single", existing.id),
        existing
      );
      return existing;
    }

    const now = new Date().toISOString();

    const escrow = await EscrowModel.create({
      id: uuidv4(),
      ...data,
      release_code: this.generateCode(),
      status: "pending" as EscrowStatus,
      created_at: now,
      updated_at: now,
    });

    await TransactionModel.create({
      id: uuidv4(),
      order_id: data.order_id,
      escrow_id: escrow.id,
      user_id: data.buyer_id,
      vendor_id: data.vendor_id,
      type: "escrow_hold",
      amount: data.amount,
      currency: "NGN",
      description: `Escrow created for order ${data.order_id}`,
      status: "pending",
      metadata: null,
      created_at: now,
      updated_at: now,
    });

    // Store cache
    await ServiceCache.set(orderKey, escrow);
    await ServiceCache.set(
      ServiceCache.key("escrow", "single", escrow.id),
      escrow
    );

    return escrow;
  }

  /** 📦 Get escrow by ID (cached) */
  static async getEscrow(id: string): Promise<IEscrow> {
    const key = ServiceCache.key("escrow", "single", id);

    const cached = await ServiceCache.get<IEscrow>(key);
    if (cached) return cached;

    const escrow = await EscrowModel.findById(id);
    if (!escrow) throw new NotFoundError("Escrow not found");

    await ServiceCache.set(key, escrow);
    return escrow;
  }

  private static generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /** 💰 Mark escrow as funded (idempotent + cache invalidation) */
  static async fundEscrow(id: string): Promise<IEscrow> {
    const escrow = await EscrowModel.findById(id);
    if (!escrow) throw new NotFoundError("Escrow not found");

    if (escrow.status === "funded") return escrow;

    const now = new Date().toISOString();

    const updated = await EscrowModel.update(id, {
      status: "funded" as EscrowStatus,
      updated_at: now,
    });

    await ServiceCache.clear("svc:escrow");

    await TransactionModel.create({
      id: uuidv4(),
      order_id: escrow.order_id,
      escrow_id: id,
      user_id: escrow.buyer_id,
      vendor_id: escrow.vendor_id,
      type: "payment",
      amount: escrow.amount,
      currency: "NGN",
      description: `Escrow funded for order ${escrow.order_id}`,
      status: "success",
      metadata: null,
      created_at: now,
      updated_at: now,
    });

    /** EMAILS */
    const buyer = await UserModel.findById(escrow.buyer_id).catch(() => null);
    const vendor = await UserModel.findById(escrow.vendor_id).catch(() => null);

    if (buyer?.email) {
      await EscrowMailService.sendEscrowFundedBuyer({
        email: buyer.email,
        name: buyer.first_name,
        order_id: escrow.order_id,
      });
    }

    if (vendor?.email) {
      await EscrowMailService.sendEscrowFundedVendor({
        email: vendor.email,
        name: vendor.first_name ?? vendor.store_name ?? "Vendor",
        order_id: escrow.order_id,
      });
    }

    return updated;
  }

  /** 📦 Mark escrow delivered (cached lookup + invalidation) */
  static async markDelivered(order_id: string): Promise<IEscrow> {
    const order = await OrderModel.findById(order_id);
    if (!order) throw new NotFoundError("Order not found");

    const escrow = await EscrowModel.findById(order.escrow_id!);
    if (!escrow) throw new NotFoundError("Escrow not found");

    if (escrow.status === "delivered") return escrow;

    const now = new Date().toISOString();
    const holdUntil = new Date(Date.now() + 3 * 86400000).toISOString();

    const updated = await EscrowModel.update(escrow.id, {
      status: "delivered" as EscrowStatus,
      hold_until: holdUntil,
      updated_at: now,
    });

    await ServiceCache.clear("svc:escrow");

    await TransactionModel.create({
      id: uuidv4(),
      order_id: order.id,
      escrow_id: escrow.id,
      user_id: order.buyer_id,
      vendor_id: order.vendor_id,
      type: "escrow_hold",
      amount: escrow.amount,
      currency: "NGN",
      description: `Order delivered, escrow hold started`,
      status: "success",
      metadata: null,
      created_at: now,
      updated_at: now,
    });

    return updated;
  }

  /** 🔓 Release escrow funds (mutates → clear cache) */
  static async releaseEscrow(order_id: string, code: string, user_id: string) {
    const now = new Date().toISOString();

    /** 1. Load order */
    const order = await OrderModel.findById(order_id);
    if (!order) throw new NotFoundError("Order not found");

    /** 2. Load escrow */
    if (!order.escrow_id)
      throw new BadRequestError("Order has no escrow attached");

    const escrow = await EscrowModel.findById(order.escrow_id);
    if (!escrow) throw new NotFoundError("Escrow not found");

    /** 3. Authorization */
    if (user_id !== order.buyer_id) {
      throw new BadRequestError("Only the buyer can release escrow");
    }

    /** 4. Locked check */
    if (escrow.disabled) {
      throw new BadRequestError(
        "This escrow is locked due to too many incorrect code attempts"
      );
    }

    /** 5. Validate code */
    if (escrow.release_code !== code) {
      const attempts = (escrow.trial_count ?? 0) + 1;

      await EscrowModel.update(escrow.id, {
        trial_count: attempts,
        disabled: attempts >= 4,
        updated_at: now,
      });

      await ServiceCache.clear("svc:escrow");

      if (attempts >= 4) {
        throw new BadRequestError(
          "Escrow disabled after 4 incorrect code attempts"
        );
      }

      throw new BadRequestError(
        `Invalid release code. Attempts left: ${4 - attempts}`
      );
    }

    /** 6. Idempotency */
    if (escrow.status === "released") {
      return {
        success: true,
        idempotent: true,
        message: "Escrow already released",
      };
    }

    /** 7. Must be delivered first */
    if (escrow.status !== "delivered") {
      throw new BadRequestError("Escrow is not eligible for release");
    }

    /** 8. Get store for payout */
    const store = await StoreModel.findOne({ user_id: order.vendor_id });
    if (!store) throw new NotFoundError("Store not found");
    if (!store.recipient_code)
      throw new BadRequestError("Store does not have a payout account");

    /** 9. Initiate Paystack payout */
    const transfer = await initiateTransfer({
      recipient_code: store.recipient_code,
      amount: escrow.amount,
      reason: `Payout for order ${order.id}`,
    });

    /** 10. Create payout */
    const payout = await PayoutService.createPendingPayout({
      order_id: order.id,
      escrow_id: escrow.id,
      recipient_code: store.recipient_code,
      amount: escrow.amount,
      currency: "NGN",
      transfer_data: transfer,
    });

    if (!transfer.ok) {
      await PayoutModel.update(payout.id, {
        status: "failed",
        updated_at: now,
      });
      console.error("PAYOUT FAILED (Vendor):", transfer.error);
    }

    /** 11. Update escrow */
    await EscrowModel.update(escrow.id, {
      status: "released",
      released_at: now,
      updated_at: now,
      trial_count: 0,
      disabled: false,
    });

    /** 12. Update order */
    await OrderModel.update(order.id, {
      status: "completed",
      updated_at: now,
    });

    await ServiceCache.clear("svc:escrow");

    /** 13. Update store analytics */
    await StoreService.updateStoreAnalytics(
      store.id,
      escrow.amount,
      order.buyer_id,
      order.order_items
    );

    /** 14. Notify vendor */
    const vendor = await UserModel.findById(order.vendor_id);
    if (vendor?.email) {
      await EscrowMailService.sendEscrowReleasedVendor({
        email: vendor.email,
        name: vendor.first_name ?? vendor.store_name ?? "Vendor",
        order_id,
        amount: escrow.amount,
      });
    }

    return {
      success: true,
      idempotent: false,
      message:
        transfer.ok === true
          ? "Escrow released and payout initiated"
          : "Escrow released but payout FAILED — admin must retry manually",
      payout_status: transfer.ok ? "pending" : "failed",
      payout_reference: transfer.reference,
    };
  }

  /** 💸 Refund escrow funds to buyer (invalidates cache) */
  static async refundEscrow(escrow_id: string, requestedBy: string) {
    const now = new Date().toISOString();

    /** 1. Load escrow */
    const escrow = await EscrowModel.findById(escrow_id);
    if (!escrow) throw new NotFoundError("Escrow not found");

    /** 2. Load order */
    const order = await OrderModel.findById(escrow.order_id!);
    if (!order)
      throw new NotFoundError("Order associated with escrow not found");

    /** Must be canceled order */
    if (order.status !== "canceled") {
      throw new BadRequestError(
        "Order must be canceled before escrow can be refunded"
      );
    }

    /** Authorization */
    if (requestedBy !== escrow.buyer_id) {
      const admin = await UserModel.findById(requestedBy).catch(() => null);
      if (!admin || admin.account_type !== "admin") {
        throw new BadRequestError("Unauthorized refund request");
      }
    }

    /** Idempotency */
    if (escrow.status === "refunded") {
      return {
        success: true,
        idempotent: true,
        message: "Escrow already refunded",
      };
    }

    /** Ensure escrow was funded */
    if (escrow.status !== "funded") {
      throw new BadRequestError(
        `Escrow cannot be refunded unless status is 'funded' (current: ${escrow.status})`
      );
    }

    /** Get buyer */
    const buyer = await UserModel.findById(escrow.buyer_id);
    if (!buyer) throw new NotFoundError("Buyer not found");
    if (!buyer.recipient_code)
      throw new BadRequestError(
        "Buyer has no registered bank account for refund"
      );

    /** Initiate Paystack transfer */
    const transfer = await initiateTransfer({
      recipient_code: buyer.recipient_code,
      amount: escrow.amount,
      reason: `Refund for order ${order.id}`,
    });

    /** ALWAYS create payout */
    const payout = await PayoutService.createPendingPayout({
      order_id: order.id,
      escrow_id: escrow.id,
      recipient_code: buyer.recipient_code,
      amount: escrow.amount,
      currency: "NGN",
      transfer_data: transfer,
    });

    if (!transfer.ok) {
      await PayoutModel.update(payout.id, {
        status: "failed",
        updated_at: now,
      });
      console.error("REFUND FAILED (Buyer):", transfer.error);
    }

    /** Mark escrow as refunded */
    await EscrowModel.update(escrow.id, {
      status: "refunded",
      refunded_at: now,
      updated_at: now,
    });

    /** Update order */
    await OrderModel.update(order.id, {
      status: "failed",
      payment_status: "refunded",
      updated_at: now,
    });

    /** Log refund transaction */
    await TransactionModel.create({
      id: uuidv4(),
      order_id: order.id,
      escrow_id: escrow.id,
      user_id: escrow.buyer_id,
      vendor_id: escrow.vendor_id,
      type: "refund",
      amount: escrow.amount,
      currency: "NGN",
      reference: transfer.reference ?? null,
      description: "Refund initiated to buyer",
      status: transfer.ok ? "pending" : "failed",
      metadata: transfer,
      created_at: now,
      updated_at: now,
    });

    await ServiceCache.clear("svc:escrow");

    /** Email buyer */
    if (buyer.email) {
      await EscrowMailService.sendEscrowRefundedBuyer({
        email: buyer.email,
        name: buyer.first_name ?? "Customer",
        order_id: order.id,
        amount: escrow.amount,
      });
    }

    return {
      success: true,
      idempotent: false,
      message:
        transfer.ok === true
          ? "Refund initiated — awaiting Paystack confirmation"
          : "Refund FAILED — admin must retry manually",
      payout_status: transfer.ok ? "pending" : "failed",
      payout_reference: transfer.reference,
    };
  }
}
