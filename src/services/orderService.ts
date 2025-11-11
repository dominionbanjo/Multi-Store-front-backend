import { v4 as uuidv4 } from "uuid";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";
import {
  OrderModel,
  IOrder,
  OrderStatus,
} from "../config/db/models/OrderModel.js";
import { EscrowService } from "./escrowService.js";
import { DeliveryService } from "./deliveryService.js";
import { TransactionModel } from "../config/db/models/TransactionModel.js";
import {
  initializePaystackPayment,
  verifyPaystackPayment,
} from "../utils/payment/paystack.js";

export class OrderService {
  /** 🧾 Create a new order (auto links to escrow) */
  static async createOrder(data: {
    buyer_id: string;
    vendor_id: string;
    store_id: string;
    subtotal: number;
    shipping_fee: number;
    total: number;
    tax?: number | null;
    notes?: string | null;
  }): Promise<IOrder> {
    if (!data.buyer_id || !data.vendor_id || !data.total)
      throw new BadRequestError("Missing required order fields");

    const now = new Date().toISOString();

    const order = await OrderModel.create({
      id: uuidv4(),
      ...data,
      tax: data.tax || null,
      notes: data.notes || null,
      status: "pending" as OrderStatus,
      created_at: now,
      updated_at: now,
    });

    // 🔐 Create escrow automatically when order is placed
    const escrow = await EscrowService.createEscrow({
      order_id: order.id,
      buyer_id: data.buyer_id,
      vendor_id: data.vendor_id,
      amount: data.total,
    });

    // 💳 Log transaction: order created (pending)
    await TransactionModel.create({
      id: uuidv4(),
      order_id: order.id,
      escrow_id: escrow.id,
      user_id: data.buyer_id,
      vendor_id: data.vendor_id,
      store_id: data.store_id,
      type: "payment",
      amount: data.total,
      currency: "NGN",
      description: `Order created and escrow initialized`,
      status: "pending",
      metadata: null,
      created_at: now,
      updated_at: now,
    });

    return order;
  }

  /** 📦 Get a single order by ID */
  static async getOrder(id: string): Promise<IOrder> {
    const order = await OrderModel.findById(id);
    if (!order) throw new NotFoundError("Order not found");
    return order;
  }

  /** 📋 Get all orders for a specific user (buyer) */
  static async getOrdersByUser(buyer_id: string): Promise<IOrder[]> {
    if (!buyer_id) throw new BadRequestError("Buyer ID is required");
    const { data } = await OrderModel.findAll({ buyer_id });
    return data;
  }

  /** 📦 Get all orders for a specific vendor */
  static async getOrdersByVendor(vendor_id: string): Promise<IOrder[]> {
    if (!vendor_id) throw new BadRequestError("Vendor ID is required");
    const { data } = await OrderModel.findAll({ vendor_id });
    return data;
  }

  /** 🔄 Update order status safely */
  static async updateOrderStatus(
    id: string,
    status: OrderStatus
  ): Promise<IOrder> {
    const order = await OrderModel.findById(id);
    if (!order) throw new NotFoundError("Order not found");

    const validStatuses: OrderStatus[] = [
      "pending",
      "processing",
      "paid",
      "in_transit",
      "delivered",
      "completed",
      "failed",
      "canceled",
    ];

    if (!validStatuses.includes(status))
      throw new BadRequestError("Invalid order status");

    const updated = await OrderModel.update(id, {
      status,
      updated_at: new Date().toISOString(),
    });

    // Escrow lifecycle tie-in
    if (status === "delivered") {
      await EscrowService.markDelivered(order.id);
    }

    return updated;
  }

  /** ❌ Cancel an order (auto-refund escrow) */
  static async cancelOrder(
    id: string
  ): Promise<{ success: boolean; message: string }> {
    const order = await OrderModel.findById(id);
    if (!order) throw new NotFoundError("Order not found");

    const now = new Date().toISOString();

    await OrderModel.update(id, {
      status: "canceled" as OrderStatus,
      updated_at: now,
    });

    if (order.escrow_id) {
      await EscrowService.refundEscrow(order.escrow_id);
    }

    // 🧾 Log transaction: refund
    await TransactionModel.create({
      id: uuidv4(),
      order_id: order.id,
      escrow_id: order.escrow_id,
      user_id: order.buyer_id,
      vendor_id: order.vendor_id,
      store_id: order.store_id,
      type: "refund",
      amount: order.total,
      currency: "NGN",
      description: `Order canceled and refunded`,
      status: "success",
      metadata: null,
      created_at: now,
      updated_at: now,
    });

    return { success: true, message: "Order canceled and escrow refunded" };
  }

  /** 💳 Create order + initiate Paystack payment */
  static async createOrderWithPaystack(data: {
    buyer_id: string;
    vendor_id: string;
    store_id: string;
    subtotal: number;
    shipping_fee: number;
    total: number;
    email: string;
  }) {
    if (!data.buyer_id || !data.vendor_id || !data.total || !data.email)
      throw new BadRequestError("Missing required fields for payment");

    const now = new Date().toISOString();

    // 🔹 Initialize payment
    const paymentInit = await initializePaystackPayment(data.email, data.total);

    // 🔹 Create order in DB
    const order = await OrderModel.create({
      id: uuidv4(),
      buyer_id: data.buyer_id,
      vendor_id: data.vendor_id,
      store_id: data.store_id,
      subtotal: data.subtotal,
      shipping_fee: data.shipping_fee,
      total: data.total,
      payment_reference: paymentInit.reference,
      payment_url: paymentInit.authorization_url,
      payment_status: "pending",
      status: "pending" as OrderStatus,
      created_at: now,
      updated_at: now,
    });

    // 🔹 Create escrow immediately
    const escrow = await EscrowService.createEscrow({
      order_id: order.id,
      buyer_id: data.buyer_id,
      vendor_id: data.vendor_id,
      amount: data.total,
    });

    // 🧾 Log transaction: payment initialized
    await TransactionModel.create({
      id: uuidv4(),
      order_id: order.id,
      escrow_id: escrow.id,
      user_id: data.buyer_id,
      vendor_id: data.vendor_id,
      store_id: data.store_id,
      type: "payment",
      amount: data.total,
      currency: "NGN",
      reference: paymentInit.reference,
      description: "Payment initialized via Paystack",
      status: "pending",
      metadata: paymentInit,
      created_at: now,
      updated_at: now,
    });

    return { order, paymentUrl: paymentInit.authorization_url };
  }

  /** ✅ Verify Paystack payment + update statuses */
  static async verifyPayment(reference: string) {
    if (!reference) throw new BadRequestError("Missing payment reference");

    const paymentData = await verifyPaystackPayment(reference);

    if (paymentData.status === "success") {
      const order = await OrderModel.findOne({
        payment_reference: reference,
      });
      if (!order) throw new NotFoundError("Order not found");

      const now = new Date().toISOString();

      // 1️⃣ Update order
      const updatedOrder = await OrderModel.update(order.id, {
        status: "paid" as OrderStatus,
        payment_status: "success",
        updated_at: now,
      });

      // 2️⃣ Fund escrow
      await EscrowService.fundEscrow(order.id);

      // 3️⃣ Initialize delivery
      await DeliveryService.createDelivery({
        order_id: order.id,
        buyer_id: order.buyer_id,
        vendor_id: order.vendor_id,
      });

      // 4️⃣ Log transaction: payment success
      await TransactionModel.create({
        id: uuidv4(),
        order_id: order.id,
        escrow_id: order.escrow_id,
        user_id: order.buyer_id,
        vendor_id: order.vendor_id,
        store_id: order.store_id,
        type: "payment",
        amount: order.total,
        currency: "NGN",
        reference,
        description: `Payment verified via Paystack for order ${order.id}`,
        status: "success",
        metadata: paymentData,
        created_at: now,
        updated_at: now,
      });

      return {
        success: true,
        message: "Payment verified and delivery queued",
        order: updatedOrder,
      };
    }

    throw new BadRequestError("Payment verification failed");
  }
}
