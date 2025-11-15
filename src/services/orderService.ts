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
import { ICartItem } from "../config/db/models/CartModel.js";

export class OrderService {
  /* -------------------------------------------------------------------------- */
  /*                       🟡 1. CREATE ORDER (OFFLINE)                         */
  /* -------------------------------------------------------------------------- */
  static async createOrder(data: {
    buyer_id: string;
    vendor_id: string;
    store_id: string;
    subtotal: number;
    shipping_fee: number;
    total: number;
    tax?: number | null;
    notes?: string | null;
    order_items: ICartItem[];
    payment_method: "offline";
  }): Promise<IOrder> {
    if (!data.buyer_id || !data.vendor_id || !data.total)
      throw new BadRequestError("Missing required order fields");

    const now = new Date().toISOString();

    const order = await OrderModel.create({
      id: uuidv4(),
      ...data,
      escrow_id: null,
      payment_reference: null,
      payment_url: null,
      payment_status: "unpaid",
      status: "pending",
      created_at: now,
      updated_at: now,
    });

    /** Log transaction (OFFLINE ORDER CREATION) */
    await TransactionModel.create({
      id: uuidv4(),
      order_id: order.id,
      user_id: order.buyer_id,
      vendor_id: order.vendor_id,
      store_id: order.store_id,
      type: "order_created",
      amount: order.total,
      currency: "NGN",
      status: "pending",
      description: "Offline order created",
      metadata: null,
      created_at: now,
      updated_at: now,
    });

    return order;
  }

  /* -------------------------------------------------------------------------- */
  /*                       🟡 2. MARK OFFLINE ORDER PAID                        */
  /* -------------------------------------------------------------------------- */
  static async markOrderPaidOffline(order_id: string) {
    const order = await OrderModel.findById(order_id);
    if (!order) throw new NotFoundError("Order not found");

    if (order.payment_method !== "offline") {
      throw new BadRequestError(
        "Only offline orders can be marked paid manually"
      );
    }

    const now = new Date().toISOString();

    const updatedOrder = await OrderModel.update(order.id, {
      payment_status: "success",
      status: "paid",
      updated_at: now,
    });

    await DeliveryService.createDelivery({
      order_id: order.id,
      buyer_id: order.buyer_id,
      vendor_id: order.vendor_id,
    });

    /** Log transaction (OFFLINE PAYMENT) */
    await TransactionModel.create({
      id: uuidv4(),
      order_id: order.id,
      user_id: order.buyer_id,
      vendor_id: order.vendor_id,
      store_id: order.store_id,
      type: "payment_offline",
      amount: order.total,
      currency: "NGN",
      status: "success",
      description: "Offline payment confirmed",
      metadata: null,
      created_at: now,
      updated_at: now,
    });

    return {
      success: true,
      message: "Offline order marked paid",
      order: updatedOrder,
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                 🟢 3. CREATE ORDER + PAYSTACK INITIALIZATION               */
  /* -------------------------------------------------------------------------- */
  static async createOrderWithPaystack(data: {
    buyer_id: string;
    vendor_id: string;
    store_id: string;
    subtotal: number;
    shipping_fee: number;
    total: number;
    email: string;
    order_items: ICartItem[];
  }) {
    const now = new Date().toISOString();

    const paymentInit = await initializePaystackPayment(data.email, data.total);

    const order = await OrderModel.create({
      id: uuidv4(),
      ...data,
      payment_method: "online",
      payment_reference: paymentInit.reference,
      payment_url: paymentInit.authorization_url,
      payment_status: "pending",
      status: "pending",
      escrow_id: null,
      created_at: now,
      updated_at: now,
    });

    // Create escrow
    const escrow = await EscrowService.createEscrow({
      order_id: order.id,
      buyer_id: data.buyer_id,
      vendor_id: data.vendor_id,
      amount: data.total,
    });

    // Update order with escrow ID
    await OrderModel.update(order.id, { escrow_id: escrow.id });

    /** Log transaction (PAYMENT INIT) */
    await TransactionModel.create({
      id: uuidv4(),
      order_id: order.id,
      escrow_id: escrow.id,
      user_id: data.buyer_id,
      vendor_id: data.vendor_id,
      store_id: data.store_id,
      type: "payment_init",
      amount: data.total,
      currency: "NGN",
      reference: paymentInit.reference,
      status: "pending",
      description: "Payment initialized via Paystack",
      metadata: paymentInit,
      created_at: now,
      updated_at: now,
    });

    return { order, paymentUrl: paymentInit.authorization_url };
  }

  /* -------------------------------------------------------------------------- */
  /*                      🟢 4. VERIFY PAYSTACK PAYMENT                          */
  /* -------------------------------------------------------------------------- */
  static async verifyPayment(reference: string) {
    if (!reference) throw new BadRequestError("Missing payment reference");

    const paymentData = await verifyPaystackPayment(reference);

    if (paymentData.status !== "success")
      throw new BadRequestError("Payment verification failed");

    const order = await OrderModel.findOne({ payment_reference: reference });
    if (!order) throw new NotFoundError("Order not found");

    const now = new Date().toISOString();

    // Update order as paid
    const updatedOrder = await OrderModel.update(order.id, {
      status: "paid",
      payment_status: "success",
      updated_at: now,
    });

    // Fund escrow
    await EscrowService.fundEscrow(order.id);

    // Start delivery
    await DeliveryService.createDelivery({
      order_id: order.id,
      buyer_id: order.buyer_id,
      vendor_id: order.vendor_id,
    });

    /** Log transaction (PAYMENT VERIFIED) */
    await TransactionModel.create({
      id: uuidv4(),
      order_id: order.id,
      escrow_id: order.escrow_id,
      user_id: order.buyer_id,
      vendor_id: order.vendor_id,
      store_id: order.store_id,
      type: "payment_confirmed",
      amount: order.total,
      currency: "NGN",
      reference,
      description: "Paystack payment verified",
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

  /* -------------------------------------------------------------------------- */
  /*                             📦 5. GET ORDERS                                */
  /* -------------------------------------------------------------------------- */
  static async getOrder(id: string): Promise<IOrder> {
    const order = await OrderModel.findById(id);
    if (!order) throw new NotFoundError("Order not found");
    return order;
  }

  static async getOrdersByUser(buyer_id: string) {
    const { data } = await OrderModel.findAll({ buyer_id });
    return data;
  }

  static async getOrdersByVendor(vendor_id: string) {
    const { data } = await OrderModel.findAll({ vendor_id });
    return data;
  }

  /* -------------------------------------------------------------------------- */
  /*                      🔄 6. UPDATE ORDER STATUS (Vendor)                    */
  /* -------------------------------------------------------------------------- */
  static async updateOrderStatus(id: string, status: OrderStatus) {
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

    if (status === "delivered" && order.payment_method === "online") {
      await EscrowService.markDelivered(order.id);
    }

    return updated;
  }

  /* -------------------------------------------------------------------------- */
  /*                ❌ 7. CANCEL ORDER (refund online orders only)              */
  /* -------------------------------------------------------------------------- */
  static async cancelOrder(id: string) {
    const order = await OrderModel.findById(id);
    if (!order) throw new NotFoundError("Order not found");

    const now = new Date().toISOString();

    await OrderModel.update(id, {
      status: "canceled",
      updated_at: now,
    });

    if (order.escrow_id && order.payment_method === "online") {
      await EscrowService.refundEscrow(order.escrow_id);
    }

    /** Log transaction (ORDER CANCELED) */
    await TransactionModel.create({
      id: uuidv4(),
      order_id: order.id,
      escrow_id: order.escrow_id,
      user_id: order.buyer_id,
      vendor_id: order.vendor_id,
      store_id: order.store_id,
      type: "order_canceled",
      amount: order.total,
      currency: "NGN",
      status: "success",
      description: "Order canceled",
      metadata: null,
      created_at: now,
      updated_at: now,
    });

    return { success: true, message: "Order canceled successfully" };
  }
}
