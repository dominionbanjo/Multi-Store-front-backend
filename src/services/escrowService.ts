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

/**
 * 💰 Escrow Service (Idempotent-safe)
 */
export class EscrowService {
  /** ➕ Create escrow record when order is created (idempotent) */
  static async createEscrow(data: {
    order_id: string;
    buyer_id: string;
    vendor_id: string;
    amount: number;
  }): Promise<IEscrow> {
    if (!data.order_id || !data.buyer_id || !data.vendor_id)
      throw new BadRequestError("Missing escrow fields");

    // 🛑 IDEMPOTENCY
    const existing = await EscrowModel.findOne({ order_id: data.order_id });
    if (existing) return existing;

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

    /** ─────────────────────── EMAILS ───────────────────────── */

    const buyer = await UserModel.findById(data.buyer_id).catch(() => null);
    const vendor = await UserModel.findById(data.vendor_id).catch(() => null);

    if (buyer?.email) {
      await EscrowMailService.sendEscrowCreatedBuyer({
        email: buyer.email,
        name: buyer.first_name,
        order_id: data.order_id,
      });
    }

    if (vendor?.email) {
      await EscrowMailService.sendEscrowCreatedVendor({
        email: vendor.email,
        name: vendor.first_name ?? vendor.store_name ?? "Vendor",
        order_id: data.order_id,
        amount: data.amount,
      });
    }

    return escrow;
  }

  /** 📦 Get escrow by ID */
  static async getEscrow(id: string): Promise<IEscrow> {
    const escrow = await EscrowModel.findById(id);
    if (!escrow) throw new NotFoundError("Escrow not found");
    return escrow;
  }

  private static generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /** 💰 Mark escrow as funded (idempotent) */
  static async fundEscrow(id: string): Promise<IEscrow> {
    const escrow = await EscrowModel.findById(id);
    if (!escrow) throw new NotFoundError("Escrow not found");

    if (escrow.status === "funded") return escrow;

    const now = new Date().toISOString();

    const updated = await EscrowModel.update(id, {
      status: "funded" as EscrowStatus,
      updated_at: now,
    });

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

    /** ─────────────────────── EMAILS ───────────────────────── */

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

  /** 📦 Mark escrow delivered (idempotent) */
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

  /** 🔓 Release escrow funds (idempotent) */
  static async releaseEscrow(order_id: string, code: string, user_id: string) {
    const now = new Date().toISOString();

    /* ----------------------------- 1. Load Order ----------------------------- */
    const order = await OrderModel.findById(order_id);
    if (!order) throw new NotFoundError("Order not found");

    /* ------------------------- 2. Load Escrow For Order ----------------------- */
    if (!order.escrow_id)
      throw new BadRequestError("Order has no escrow attached");

    const escrow = await EscrowModel.findById(order.escrow_id);
    if (!escrow) throw new NotFoundError("Escrow not found");

    /* ----------------------- 3. Authorization Check -------------------------- */
    if (user_id !== order.buyer_id)
      throw new BadRequestError("Only the buyer can release escrow");

    /* ------------------------ 4. Validate Release Code ------------------------- */
    if (escrow.release_code !== code)
      throw new BadRequestError("Invalid release code");

    /* ------------------------- 5. Idempotency Check --------------------------- */
    if (escrow.status === "released") {
      return {
        success: true,
        idempotent: true,
        message: "Escrow already released",
      };
    }

    /* ------------------------ 6. Escrow Must Be Delivered ---------------------- */
    if (escrow.status !== "delivered") {
      throw new BadRequestError("Escrow is not eligible for release");
    }

    /* --------------------------- 7. Fetch Store ------------------------------- */
    const store = await StoreModel.findById(order.vendor_id!);
    if (!store) throw new NotFoundError("Store not found");

    if (!store.recipient_code)
      throw new BadRequestError("Store does not have a payout account");

    /* --------------------------- 8. Initiate Transfer ------------------------- */
    const transfer = await initiateTransfer({
      recipient_code: store.recipient_code,
      amount: escrow.amount,
      reason: `Payout for order ${order.id}`,
    });

    if (!transfer) {
      throw new BadRequestError("Failed to initiate payout transfer");
    }

    /* ----------------------- 9. Create Pending Payout Record ------------------ */
    await PayoutService.createPendingPayout({
      order_id: order.id,
      escrow_id: escrow.id,
      recipient_code: store.recipient_code,
      amount: escrow.amount,
      currency: "NGN",
      transfer_data: transfer,
    });

    /* --------------------------- 10. Update Escrow ---------------------------- */
    await EscrowModel.update(escrow.id, {
      status: "released",
      released_at: now,
      updated_at: now,
    });

    /* --------------------------- 11. Update Order ----------------------------- */
    await OrderModel.update(order.id, {
      status: "completed",
      updated_at: now,
    });

    /* ---------------------- 12. Update Store Stats & Customers ----------------- */
    await this.updateStoreStatsAndCustomers(
      store.id,
      order.buyer_id,
      escrow.amount
    );

    /* ---------------------------- 13. Notification ----------------------------- */
    const vendor = await UserModel.findById(order.vendor_id).catch(() => null);

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
      message: "Escrow released and payout initiated",
      payout_transfer_code: transfer.transfer_code,
    };
  }

  /** 💸 Refund escrow to the buyer (secure, idempotent, payout-enabled) */
  static async refundEscrow(
    escrow_id: string,
    requestedBy: string // user_id (buyer or admin)
  ) {
    const now = new Date().toISOString();

    /* ----------------------------- 1. Load Escrow ----------------------------- */
    const escrow = await EscrowModel.findById(escrow_id);
    if (!escrow) throw new NotFoundError("Escrow not found");

    /* ------------------------- 2. Load Order For Escrow ----------------------- */
    const order = escrow.order_id
      ? await OrderModel.findById(escrow.order_id)
      : null;

    if (!order)
      throw new NotFoundError("Order associated with escrow not found");

    /* -------------------------- 3. Validate Order Status ---------------------- */
    if (order.status !== "canceled") {
      throw new BadRequestError(
        "Order must be canceled before escrow can be refunded"
      );
    }

    /* --------------------------- 4. Authorization Check ------------------------ */
    if (requestedBy !== escrow.buyer_id) {
      const requester = await UserModel.findById(requestedBy).catch(() => null);
      if (!requester || requester.account_type !== "admin") {
        throw new BadRequestError("Unauthorized refund request");
      }
    }

    /* ----------------------------- 5. Idempotency ----------------------------- */
    if (escrow.status === "refunded") {
      return {
        success: true,
        idempotent: true,
        message: "Escrow already refunded",
      };
    }

    /* ------------------------- 6. Escrow MUST BE FUNDED ----------------------- */
    if (escrow.status !== "funded") {
      throw new BadRequestError(
        `Escrow cannot be refunded unless status is 'funded' (current: ${escrow.status})`
      );
    }

    /* -------------------------- 7. Fetch Buyer Details ------------------------ */
    const buyer = await UserModel.findById(escrow.buyer_id);
    if (!buyer) throw new NotFoundError("Buyer not found");

    if (!buyer.recipient_code) {
      throw new BadRequestError(
        "Buyer has no registered bank account for refund"
      );
    }

    /* --------------------- 8. Initiate Paystack Refund Transfer --------------- */
    const transfer = await initiateTransfer({
      recipient_code: buyer.recipient_code,
      amount: escrow.amount,
      reason: `Refund for order ${order.id}`,
    });

    if (!transfer) {
      throw new BadRequestError("Failed to initiate refund payout");
    }

    /* --------------------------- 9. Create Pending Payout ---------------------- */
    await PayoutService.createPendingPayout({
      order_id: order.id,
      escrow_id: escrow.id,
      recipient_code: buyer.recipient_code,
      amount: escrow.amount,
      currency: "NGN",
      transfer_data: transfer,
    });

    /* ------------------------------- 10. Update Escrow ------------------------ */
    await EscrowModel.update(escrow.id, {
      status: "refunded",
      refunded_at: now,
      updated_at: now,
    });

    /* ------------------------------- 11. Update Order ------------------------- */
    await OrderModel.update(order.id, {
      status: "failed",
      payment_status: "refunded",
      updated_at: now,
    });

    /* ---------------------------- 12. Log Transaction ------------------------- */
    await TransactionModel.create({
      id: uuidv4(),
      order_id: order.id,
      escrow_id: escrow.id,
      user_id: escrow.buyer_id,
      vendor_id: escrow.vendor_id,
      type: "refund",
      amount: escrow.amount,
      currency: "NGN",
      reference: transfer.transfer_code ?? null,
      description: "Refund initiated to buyer",
      status: "pending",
      metadata: transfer,
      created_at: now,
      updated_at: now,
    });

    /* ------------------------------- 13. Email Buyer -------------------------- */
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
      message: "Refund initiated — awaiting Paystack confirmation",
      transfer_code: transfer.transfer_code,
    };
  }

  // ───────────────────────────────────────────────
  // 📈 Update store analytics
  // ───────────────────────────────────────────────
  private static async updateStoreStatsAndCustomers(
    store_id: string,
    buyer_id: string,
    amount: number
  ) {
    const store = await StoreModel.findById(store_id);
    if (!store) return;

    const buyer = await UserModel.findById(buyer_id);
    if (!buyer) return;

    const total_revenue = Number(store.total_revenue || 0) + amount;
    const total_orders = Number(store.total_orders || 0) + 1;

    const now = new Date();
    const month = now.toLocaleString("default", { month: "short" });
    const year = now.getFullYear();

    const analytics = store.analytics || {
      sales: [],
      orders: [],
      customers: [],
    };

    const sale = analytics.sales.find(
      (s) => s.month === month && s.year === year
    );
    if (sale) sale.amount += amount;
    else analytics.sales.push({ month, year, amount });

    const orderRec = analytics.orders.find(
      (o) => o.month === month && o.year === year
    );
    if (orderRec) orderRec.count += 1;
    else analytics.orders.push({ month, year, count: 1 });

    const customers = (store.customers || []) as IStoreCustomer[];
    const spent = Number(amount);
    const last_order_date = now.toISOString();

    const existing = customers.find((c) => c.id === buyer.id);

    let buyerLocation: string | undefined = undefined;
    if (buyer.address) {
      const { city, state, country } = buyer.address;
      const parts = [city, state, country].filter(Boolean);
      if (parts.length > 0) buyerLocation = parts.join(", ");
    }

    if (existing) {
      existing.orders += 1;
      existing.spent += spent;
      existing.last_order_date = last_order_date;
      existing.rating = buyer.rating_average || existing.rating;
      if (buyerLocation) existing.location = buyerLocation;
    } else {
      customers.push({
        id: buyer.id,
        name: `${buyer.first_name} ${buyer.last_name}`,
        email: buyer.email,
        phone_number: buyer.phone_number,
        location: buyerLocation || null,
        orders: 1,
        spent,
        rating: buyer.rating_average || 0,
        last_order_date,
      });
    }

    const active_customers = customers.length;

    await StoreModel.update(store_id, {
      analytics,
      customers,
      total_revenue,
      total_orders,
      active_customers,
      updated_at: new Date().toISOString(),
    });
  }
}
