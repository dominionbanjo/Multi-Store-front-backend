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

/**
 * 💰 Escrow Service
 * Handles escrow creation, funding, holding, release (via Paystack), and refunds.
 */
export class EscrowService {
  /** ➕ Create escrow record when order is created */
  static async createEscrow(data: {
    order_id: string;
    buyer_id: string;
    vendor_id: string;
    amount: number;
  }): Promise<IEscrow> {
    if (!data.order_id || !data.buyer_id || !data.vendor_id)
      throw new BadRequestError("Missing escrow fields");

    const escrow = await EscrowModel.create({
      id: uuidv4(),
      ...data,
      release_code: this.generateCode(),
      status: "pending" as EscrowStatus,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Log transaction: escrow_hold
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return escrow;
  }

  /** 📦 Get escrow by ID */
  static async getEscrow(id: string): Promise<IEscrow> {
    const escrow = await EscrowModel.findById(id);
    if (!escrow) throw new NotFoundError("Escrow not found");
    return escrow;
  }

  /** 🔢 Generate a 6-digit release code */
  private static generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /** 💰 Mark escrow as funded after successful payment */
  static async fundEscrow(id: string): Promise<IEscrow> {
    const escrow = await EscrowModel.findById(id);
    if (!escrow) throw new NotFoundError("Escrow not found");

    const updated = await EscrowModel.update(id, {
      status: "funded" as EscrowStatus,
      updated_at: new Date().toISOString(),
    });

    // Log transaction: payment
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return updated;
  }

  /** 📦 Mark escrow as delivered (start hold period before release) */
  static async markDelivered(order_id: string): Promise<IEscrow> {
    const order = await OrderModel.findById(order_id);
    if (!order) throw new NotFoundError("Order not found");

    const escrow = await EscrowModel.findById(order.escrow_id!);
    if (!escrow) throw new NotFoundError("Escrow not found");

    const updated = await EscrowModel.update(escrow.id, {
      status: "delivered" as EscrowStatus,
      hold_until: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3-day hold
      updated_at: new Date().toISOString(),
    });

    // Log transaction: escrow_hold (delivered)
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return updated;
  }

  /** 🔓 Release escrow funds via Paystack → Store account */
  static async releaseEscrow(order_id: string, code: string) {
    const order = await OrderModel.findById(order_id);
    if (!order) throw new NotFoundError("Order not found");

    const escrow = await EscrowModel.findById(order.escrow_id!);
    if (!escrow) throw new NotFoundError("Escrow not found");

    if (escrow.release_code !== code)
      throw new BadRequestError("Invalid release code");

    const store = await StoreModel.findById(order.store_id!);
    if (!store) throw new NotFoundError("Store not found for vendor");

    if (!store.recipient_code)
      throw new BadRequestError("Store has no registered payout account");

    // 💸 Transfer funds via Paystack
    const transfer = await initiateTransfer({
      recipient_code: store.recipient_code,
      amount: escrow.amount,
      reason: `Payout for order ${order.id}`,
    });

    const now = new Date().toISOString();

    // 🔹 Update escrow + order
    await EscrowModel.update(escrow.id, {
      status: "released" as EscrowStatus,
      released_at: now,
    });

    await OrderModel.update(order_id, {
      status: "completed" as OrderStatus,
      updated_at: now,
    });

    // 📊 Update store analytics + customers
    await this.updateStoreStatsAndCustomers(
      store.id,
      order.buyer_id,
      escrow.amount
    );

    // 🧾 Log transaction: payout
    await TransactionModel.create({
      id: uuidv4(),
      order_id: order.id,
      escrow_id: escrow.id,
      vendor_id: order.vendor_id,
      store_id: order.store_id,
      type: "payout",
      amount: escrow.amount,
      currency: "NGN",
      reference: transfer?.transfer_code || null,
      description: `Funds released to store for order ${order.id}`,
      status: "success",
      metadata: transfer,
      created_at: now,
      updated_at: now,
    });

    return { success: true, message: "Funds transferred and store updated" };
  }

  /** 💸 Refund escrow when order is canceled */
  static async refundEscrow(id: string) {
    const escrow = await EscrowModel.findById(id);
    if (!escrow) throw new NotFoundError("Escrow not found");

    await EscrowModel.update(id, {
      status: "refunded" as EscrowStatus,
      refunded_at: new Date().toISOString(),
    });

    if (escrow.order_id) {
      await OrderModel.update(escrow.order_id, {
        status: "failed" as OrderStatus,
        updated_at: new Date().toISOString(),
      });
    }

    // 🧾 Log transaction: refund
    await TransactionModel.create({
      id: uuidv4(),
      order_id: escrow.order_id,
      escrow_id: escrow.id,
      user_id: escrow.buyer_id,
      vendor_id: escrow.vendor_id,
      type: "refund",
      amount: escrow.amount,
      currency: "NGN",
      description: `Refund issued for order ${escrow.order_id}`,
      status: "success",
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return { success: true, message: "Escrow refunded successfully" };
  }

  // ───────────────────────────────────────────────
  // 📈 Update store analytics + customers
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

    // 💰 Sales
    const sale = analytics.sales.find(
      (s) => s.month === month && s.year === year
    );
    if (sale) sale.amount += amount;
    else analytics.sales.push({ month, year, amount });

    // 🧾 Orders
    const orderRec = analytics.orders.find(
      (o) => o.month === month && o.year === year
    );
    if (orderRec) orderRec.count += 1;
    else analytics.orders.push({ month, year, count: 1 });

    // ── Update customers JSON array
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
