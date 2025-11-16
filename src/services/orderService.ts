import { v4 as uuidv4 } from "uuid";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";
import {
  OrderModel,
  IOrder,
  OrderStatus,
} from "../config/db/models/OrderModel.js";
import { EscrowService } from "./escrowService.js";
import { DeliveryService } from "./deliveryService.js";
import {
  initializePaystackPayment,
  verifyPaystackPayment,
} from "../utils/payment/paystack.js";
import { ICartItem } from "../config/db/models/CartModel.js";
import { ProductModel, TransactionModel } from "../config/db/models/index.js";
import { OrderMailService } from "../utils/mails/OrderMailService.js";
import { UserModel } from "../config/db/models/UserModel.js";

export class OrderService {
  private static async buildOrderItems(order_items: ICartItem[]) {
    let subtotal = 0;
    const validated: ICartItem[] = [];

    for (const item of order_items) {
      const product = await ProductModel.findById(item.product_id);
      if (!product)
        throw new BadRequestError(`Product not found: ${item.product_id}`);
      if (item.quantity < 1 || item.quantity > product.stock)
        throw new BadRequestError(
          "Invalid quantity request or product out of stock"
        );

      const basePrice = product.price;
      const discount = product.discount_price;
      const finalUnitPrice = discount ?? basePrice;
      const lineTotal = finalUnitPrice * item.quantity;

      const validatedItem: ICartItem = {
        product_id: product.id,
        name: product.name,
        slug: product.slug,
        price: basePrice,
        discount_price: product.discount_price,
        image: product.image?.url || null,
        quantity: item.quantity,
        size: item.size ?? null,
        color: item.color ?? null,
        shipping_cost: product.shipping_cost ?? null,
      };

      validated.push(validatedItem);
      subtotal += lineTotal;
    }

    return { validatedItems: validated, subtotal };
  }

  /* -------------------------------------------------------------------------- */
  /*                       🟡 1. CREATE ORDER (OFFLINE)                         */
  /* -------------------------------------------------------------------------- */
  static async createOrder(data: {
    buyer_id: string;
    vendor_id: string;
    store_id: string;
    tax?: number;
    notes?: string;
    order_items: ICartItem[];
    payment_method: "offline";
  }): Promise<IOrder> {
    if (!data.order_items || data.order_items.length === 0)
      throw new BadRequestError("Order items are required");

    const now = new Date().toISOString();

    // 🔒 Validate & build items using backend data
    const { validatedItems, subtotal } = await this.buildOrderItems(
      data.order_items
    );

    const shipping_fee = 0; // Or fetch from store settings
    const tax = data.tax ?? 0;
    const total = subtotal + shipping_fee + tax;

    const order = await OrderModel.create({
      id: uuidv4(),
      buyer_id: data.buyer_id,
      vendor_id: data.vendor_id,
      store_id: data.store_id,
      order_items: validatedItems,
      subtotal,
      shipping_fee,
      tax,
      total,
      payment_method: "offline",
      payment_reference: null,
      payment_url: null,
      payment_status: "unpaid",
      escrow_id: null,
      status: "pending",
      notes: data.notes ?? null,
      created_at: now,
      updated_at: now,
    });

    await TransactionModel.create({
      id: uuidv4(),
      order_id: order.id,
      user_id: data.buyer_id,
      vendor_id: data.vendor_id,
      store_id: data.store_id,
      type: "order_created",
      amount: total,
      currency: "NGN",
      status: "pending",
      description: "Offline order created",
      metadata: null,
      created_at: now,
      updated_at: now,
    });

    // ─────────────────────────────────────────────────────
    // SEND EMAILS (Buyer + Vendor) for order creation
    // ─────────────────────────────────────────────────────
    try {
      const buyer = await UserModel.findById(data.buyer_id).catch(() => null);
      const vendor = await UserModel.findById(data.vendor_id).catch(() => null);

      if (buyer?.email) {
        await OrderMailService.sendOrderCreated({
          email: buyer.email,
          name: buyer.first_name,
          order,
        });
      }

      if (vendor?.email) {
        await OrderMailService.sendVendorNewOrder({
          email: vendor.email,
          name: vendor.first_name ?? vendor.store_name ?? "Vendor",
          order,
        });
      }
    } catch (err) {
      // Do not fail the order if emails fail; just log
      console.error("Order creation email error:", err);
    }

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

    // ─────────────────────────────────────────────────────
    // SEND EMAILS: Payment verified for offline payment
    // ─────────────────────────────────────────────────────
    try {
      const buyer = await UserModel.findById(order.buyer_id).catch(() => null);
      const vendor = await UserModel.findById(order.vendor_id).catch(
        () => null
      );

      if (buyer?.email) {
        await OrderMailService.sendPaymentVerified({
          email: buyer.email,
          name: buyer.first_name,
          order: updatedOrder,
        });
      }

      if (vendor?.email) {
        await OrderMailService.sendVendorPaymentVerified({
          email: vendor.email,
          name: vendor.first_name ?? vendor.store_name ?? "Vendor",
          order: updatedOrder,
        });
      }
    } catch (err) {
      console.error("Offline payment email error:", err);
    }

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
    email: string;
    order_items: ICartItem[];
  }) {
    if (!data.order_items || data.order_items.length === 0)
      throw new BadRequestError("Order items required");

    const now = new Date().toISOString();

    // 🔒 Validate & build items from DB
    const { validatedItems, subtotal } = await this.buildOrderItems(
      data.order_items
    );

    const shipping_fee = 0; // or calculate
    const tax = 0;
    const total = subtotal + shipping_fee + tax;

    const paymentInit = await initializePaystackPayment(data.email, total);

    const order = await OrderModel.create({
      id: uuidv4(),
      buyer_id: data.buyer_id,
      vendor_id: data.vendor_id,
      store_id: data.store_id,
      order_items: validatedItems,
      subtotal,
      shipping_fee,
      tax,
      total,
      payment_method: "online",
      payment_reference: paymentInit.reference,
      payment_url: paymentInit.authorization_url,
      payment_access_code: paymentInit.access_code,
      payment_status: "pending",
      escrow_id: null,
      status: "pending",
      created_at: now,
      updated_at: now,
    });

    const escrow = await EscrowService.createEscrow({
      order_id: order.id,
      buyer_id: data.buyer_id,
      vendor_id: data.vendor_id,
      amount: total,
    });

    await OrderModel.update(order.id, { escrow_id: escrow.id });

    await TransactionModel.create({
      id: uuidv4(),
      order_id: order.id,
      escrow_id: escrow.id,
      user_id: data.buyer_id,
      vendor_id: data.vendor_id,
      store_id: data.store_id,
      type: "payment_init",
      amount: total,
      currency: "NGN",
      reference: paymentInit.reference,
      status: "pending",
      description: "Payment initialized via Paystack",
      metadata: paymentInit,
      created_at: now,
      updated_at: now,
    });

    // ─────────────────────────────────────────────────────
    // SEND EMAILS (Order created notifications) — no payment link
    // ─────────────────────────────────────────────────────
    try {
      const buyer = await UserModel.findById(data.buyer_id).catch(() => null);
      const vendor = await UserModel.findById(data.vendor_id).catch(() => null);

      if (buyer?.email) {
        await OrderMailService.sendOrderCreated({
          email: buyer.email,
          name: buyer.first_name,
          order,
        });
      }

      if (vendor?.email) {
        await OrderMailService.sendVendorNewOrder({
          email: vendor.email,
          name: vendor.first_name ?? vendor.store_name ?? "Vendor",
          order,
        });
      }
    } catch (err) {
      console.error("Order-with-paystack email error:", err);
    }

    return { order, paymentUrl: paymentInit.authorization_url };
  }

  /* -------------------------------------------------------------------------- */
  /*                      🟢 4. VERIFY PAYSTACK PAYMENT                          */
  /* -------------------------------------------------------------------------- */
  static async verifyPayment(reference: string) {
    const order = await OrderModel.findOne({ payment_reference: reference });
    if (!order) throw new NotFoundError("Order not found");

    // 1️⃣ IDEMPOTENCY USING STATUS
    if (order.payment_status === "success") {
      return {
        success: true,
        idempotent: true,
        message: "Payment already verified",
        order,
      };
    }

    const paymentData = await verifyPaystackPayment(reference);

    if (paymentData.status !== "success")
      throw new BadRequestError("Payment verification failed");

    const amountPaid = paymentData.amount / 100;
    if (amountPaid !== order.total) {
      throw new BadRequestError(
        `Amount mismatch: Paid ${amountPaid} vs expected ${order.total}`
      );
    }

    const now = new Date().toISOString();

    // 2️⃣ UPDATE STATUS ONCE
    const updatedOrder = await OrderModel.update(order.id, {
      status: "paid",
      payment_status: "success",
      updated_at: now,
    });

    // 3️⃣ FUND ESCROW (also idempotent)
    await EscrowService.fundEscrow(order.id);

    // 4️⃣ START DELIVERY (also idempotent)
    await DeliveryService.createDelivery({
      order_id: order.id,
      buyer_id: order.buyer_id,
      vendor_id: order.vendor_id,
    });

    // ─────────────────────────────────────────────────────
    // SEND EMAILS: Payment verified (buyer + vendor)
    // ─────────────────────────────────────────────────────
    try {
      const buyer = await UserModel.findById(order.buyer_id).catch(() => null);
      const vendor = await UserModel.findById(order.vendor_id).catch(
        () => null
      );

      if (buyer?.email) {
        await OrderMailService.sendPaymentVerified({
          email: buyer.email,
          name: buyer.first_name,
          order: updatedOrder,
        });
      }

      if (vendor?.email) {
        await OrderMailService.sendVendorPaymentVerified({
          email: vendor.email,
          name: vendor.first_name ?? vendor.store_name ?? "Vendor",
          order: updatedOrder,
        });
      }
    } catch (err) {
      console.error("Verify payment email error:", err);
    }

    return {
      success: true,
      idempotent: false,
      message: "Payment verified",
      order: updatedOrder,
    };
  }

  static async handlePaystackWebhook(data: any): Promise<void> {
    const reference = data.reference;

    const order = await OrderModel.findOne({ payment_reference: reference });

    if (!order) {
      console.log("Order not found for webhook reference:", reference);
      return;
    }

    // Idempotency
    if (order.payment_status === "success") {
      console.log("Duplicate webhook — already processed:", reference);
      return;
    }

    /* ------------------------------------------------------------------
     * 🔐 SECURITY: Validate amount paid from Paystack webhook
     * ------------------------------------------------------------------*/
    const amountPaid = Number(data.amount) / 100; // Paystack amount is in kobo
    const expected = Number(order.total);

    if (amountPaid !== expected) {
      console.error(
        `SECURITY ALERT: Amount mismatch in webhook for order ${order.id}.
        Paid: ${amountPaid} | Expected: ${expected}`
      );
      return; // ❌ STOP — do NOT mark order paid or fund escrow
    }

    const now = new Date().toISOString();

    await OrderModel.update(order.id, {
      status: "paid",
      payment_status: "success",
      updated_at: now,
    });

    await EscrowService.fundEscrow(order.id);

    await DeliveryService.createDelivery({
      order_id: order.id,
      buyer_id: order.buyer_id,
      vendor_id: order.vendor_id,
    });

    await TransactionModel.create({
      id: uuidv4(),
      order_id: order.id,
      escrow_id: order.escrow_id,
      user_id: order.buyer_id,
      vendor_id: order.vendor_id,
      store_id: order.store_id,
      type: "payment_webhook",
      amount: order.total,
      currency: "NGN",
      reference,
      status: "success",
      description: "Payment confirmed by Paystack webhook",
      metadata: data,
      created_at: now,
      updated_at: now,
    });

    // EMAILS
    try {
      const buyer = await UserModel.findById(order.buyer_id).catch(() => null);
      const vendor = await UserModel.findById(order.vendor_id).catch(
        () => null
      );

      if (buyer?.email) {
        await OrderMailService.sendPaymentVerified({
          email: buyer.email,
          name: buyer.first_name,
          order,
        });
      }

      if (vendor?.email) {
        await OrderMailService.sendVendorPaymentVerified({
          email: vendor.email,
          name: vendor.first_name ?? vendor.store_name ?? "Vendor",
          order,
        });
      }
    } catch (err) {
      console.error("Webhook payment email error:", err);
    }

    console.log("Webhook payment confirmed for order:", order.id);
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

    // ─────────────────────────────────────────────────────
    // SEND EMAIL: order status update to buyer
    // ─────────────────────────────────────────────────────
    try {
      const buyer = await UserModel.findById(order.buyer_id).catch(() => null);
      if (buyer?.email) {
        await OrderMailService.sendOrderStatusUpdate({
          email: buyer.email,
          name: buyer.first_name,
          order: updated,
          status,
        });
      }
    } catch (err) {
      console.error("Order status email error:", err);
    }

    return updated;
  }

  /* -------------------------------------------------------------------------- */
  /*                ❌ 7. CANCEL ORDER (refund online orders only)              */
  /* -------------------------------------------------------------------------- */
  static async cancelOrder(id: string, requestedBy: string) {
    const order = await OrderModel.findById(id);
    if (!order) throw new NotFoundError("Order not found");

    /* -------------------------------------------------------------------------- */
    /*                                1. SECURITY CHECKS                           */
    /* -------------------------------------------------------------------------- */

    // Delivered or completed orders cannot be canceled
    if (order.status === "delivered" || order.status === "completed") {
      throw new BadRequestError(
        "Delivered or completed orders cannot be canceled"
      );
    }

    // Already canceled? Idempotent return
    if (order.status === "canceled") {
      return {
        success: true,
        idempotent: true,
        message: "Order already canceled",
      };
    }

    const now = new Date().toISOString();

    /* -------------------------------------------------------------------------- */
    /*                                 2. CANCEL ORDER                             */
    /* -------------------------------------------------------------------------- */
    await OrderModel.update(id, {
      status: "canceled",
      updated_at: now,
    });

    /* -------------------------------------------------------------------------- */
    /*                        3. REFUND ESCROW IF ONLINE PAYMENT                   */
    /* -------------------------------------------------------------------------- */

    if (order.escrow_id && order.payment_method === "online") {
      try {
        await EscrowService.refundEscrow(order.escrow_id, requestedBy);
      } catch (err) {
        console.error("Refund error in cancelOrder:", err);
        // We DO NOT throw here → order is still canceled.
        // Refund will retry via dashboard/manual if needed.
      }
    }

    /* -------------------------------------------------------------------------- */
    /*                            4. LOG TRANSACTION (CANCELED)                   */
    /* -------------------------------------------------------------------------- */
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
      description: "Order canceled by user",
      metadata: null,
      created_at: now,
      updated_at: now,
    });

    /* -------------------------------------------------------------------------- */
    /*                              5. SEND EMAIL TO BUYER                         */
    /* -------------------------------------------------------------------------- */
    try {
      const buyer = await UserModel.findById(order.buyer_id).catch(() => null);
      if (buyer?.email) {
        await OrderMailService.sendOrderCanceled({
          email: buyer.email,
          name: buyer.first_name ?? "Customer",
          order,
        });
      }
    } catch (err) {
      console.error("Order canceled email error:", err);
    }

    /* -------------------------------------------------------------------------- */

    return {
      success: true,
      idempotent: false,
      message: "Order canceled successfully",
    };
  }
}
