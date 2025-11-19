import { v4 as uuidv4 } from "uuid";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";
import {
  OrderModel,
  IOrder,
  OrderStatus,
  PaymentStatus,
} from "../config/db/models/OrderModel.js";
import { EscrowService } from "./escrowService.js";
import { DeliveryService } from "./deliveryService.js";
import {
  initializePaystackPayment,
  verifyPaystackPayment,
} from "../utils/payment/paystack.js";
import { ICartItem } from "../config/db/models/CartModel.js";
import {
  DeliveryModel,
  ProductModel,
  StoreModel,
  TransactionModel,
} from "../config/db/models/index.js";
import { OrderMailService } from "../utils/mails/OrderMailService.js";
import { UserModel } from "../config/db/models/UserModel.js";
import StoreService from "./storeService.js";
import { ServiceCache } from "../utils/helpers/ServiceCache.js";

export class OrderService {
  /* -------------------------------------------------------------------------- */
  /*  VALIDATE ITEMS USING DB (unchanged)                                       */
  /* -------------------------------------------------------------------------- */
  private static async buildOrderItems(order_items: ICartItem[]) {
    let subtotal = 0;
    const validated: ICartItem[] = [];

    for (const item of order_items) {
      const product = await ProductModel.findById(item.product_id);
      if (!product)
        throw new BadRequestError(`Product not found: ${item.product_id}`);

      // Validate quantity
      if (item.quantity < 1 || item.quantity > product.stock) {
        throw new BadRequestError(
          `Invalid quantity for '${product.name}'. Available stock: ${product.stock}`
        );
      }

      const productSizes = product.sizes?.map((s) => s.trim()) || [];
      if (productSizes.length > 0) {
        if (!item.size) {
          throw new BadRequestError(
            `Size is required for '${
              product.name
            }'. Available sizes: ${productSizes.join(", ")}`
          );
        }
        if (!productSizes.includes(String(item.size).trim())) {
          throw new BadRequestError(
            `Invalid size '${item.size}' for '${
              product.name
            }'. Available sizes: ${productSizes.join(", ")}`
          );
        }
      } else {
        item.size = null;
      }

      const productColors = product.colors?.map((c) => c.trim()) || [];
      if (productColors.length > 0) {
        if (!item.color) {
          throw new BadRequestError(
            `Color is required for '${
              product.name
            }'. Available colors: ${productColors.join(", ")}`
          );
        }

        if (!productColors.includes(String(item.color).trim())) {
          throw new BadRequestError(
            `Invalid color '${item.color}' for '${
              product.name
            }'. Available colors: ${productColors.join(", ")}`
          );
        }
      } else {
        item.color = null;
      }

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
  /* 🔥 1. CREATE OFFLINE ORDER — MULTI-VENDOR (AUTO CREATES DELIVERY)          */
  /* -------------------------------------------------------------------------- */
  static async createOrder(data: {
    buyer_id: string;
    tax?: number;
    notes?: string;
    order_items: ICartItem[];
    payment_method: "offline";
  }) {
    if (!data.order_items || data.order_items.length === 0)
      throw new BadRequestError("Order items are required");

    const now = new Date().toISOString();

    const { validatedItems } = await this.buildOrderItems(data.order_items);

    const groups: Record<string, ICartItem[]> = {};
    for (const item of validatedItems) {
      const product = await ProductModel.findById(item.product_id);
      const vendorId = product.vendor_id;

      if (!groups[vendorId]) groups[vendorId] = [];
      groups[vendorId].push(item);
    }

    const orders: IOrder[] = [];

    for (const vendor_id of Object.keys(groups)) {
      const vendorItems = groups[vendor_id];

      let subtotal = 0;
      for (const item of vendorItems) {
        subtotal += (item.discount_price ?? item.price) * item.quantity;
      }

      const shipping_fee = 0;
      const tax = data.tax ?? 0;
      const total = subtotal + shipping_fee + tax;

      const order = await OrderModel.create({
        id: uuidv4(),
        buyer_id: data.buyer_id,
        vendor_id,
        order_items: vendorItems,
        subtotal,
        shipping_fee,
        tax,
        total,
        payment_method: "offline",
        payment_reference: null,
        payment_url: null,
        payment_access_code: null,
        payment_status: "unpaid",
        escrow_id: null,
        delivery_id: null,
        status: "pending",
        notes: data.notes ?? null,
        created_at: now,
        updated_at: now,
      });

      await ServiceCache.clear("svc:order");

      await TransactionModel.create({
        id: uuidv4(),
        order_id: order.id,
        user_id: data.buyer_id,
        vendor_id,
        type: "order_created",
        amount: total,
        currency: "NGN",
        status: "pending",
        description: "Offline order created",
        metadata: null,
        created_at: now,
        updated_at: now,
      });

      const delivery = await DeliveryService.createDelivery({
        order_id: order.id,
        buyer_id: data.buyer_id,
        vendor_id,
      });

      await OrderModel.update(order.id, {
        delivery_id: delivery.id,
      });

      order.delivery_id = delivery.id;

      try {
        const buyer = await UserModel.findById(data.buyer_id).catch(() => null);
        const vendor = await UserModel.findById(vendor_id).catch(() => null);

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
        console.error("Offline order email error:", err);
      }

      orders.push(order);
    }

    return {
      success: true,
      successfulOrders: orders.map((o) => ({ order: o })),
      failedVendors: [],
    };
  }

  /* -------------------------------------------------------------------------- */
  /* 🔥 2. FULFILL OFFLINE ORDER                                                */
  /* -------------------------------------------------------------------------- */
  static async fulfillOfflineDelivery(order_id: string, vendor_id: string) {
    const order = await OrderModel.findById(order_id);
    if (!order) throw new NotFoundError("Order not found");

    if (order.vendor_id !== vendor_id) {
      throw new BadRequestError("You can only fulfill your own orders");
    }

    if (order.payment_method !== "offline") {
      throw new BadRequestError("This is not an offline order");
    }

    const delivery = await DeliveryModel.findOne({ order_id });
    if (!delivery) throw new BadRequestError("Delivery record not found");

    const now = new Date().toISOString();

    await DeliveryModel.update(delivery.id, {
      delivery_status: "confirmed",
      delivered_at: now,
      updated_at: now,
    });

    const updatedOrder = await OrderModel.update(order.id, {
      status: "completed",
      payment_status: "paid" as PaymentStatus,
      updated_at: now,
    });

    await ServiceCache.clear("svc:order");

    await StoreService.updateStoreAnalytics(
      updatedOrder.vendor_id,
      updatedOrder.total,
      updatedOrder.buyer_id,
      updatedOrder.order_items
    );

    await TransactionModel.create({
      id: uuidv4(),
      order_id,
      user_id: order.buyer_id,
      vendor_id,
      type: "offline_fulfillment",
      amount: order.total,
      currency: "NGN",
      status: "success",
      description: "Order fulfilled offline",
      metadata: null,
      created_at: now,
      updated_at: now,
    });

    return {
      success: true,
      message: "Offline delivery fulfilled",
      order: updatedOrder,
    };
  }

  private static async validateVendorForOnline(vendor_id: string) {
    const store = await StoreModel.findOne({ user_id: vendor_id });
    if (!store) {
      throw new BadRequestError(`Vendor not found: ${vendor_id}`);
    }

    if (!store.payout_verified) {
      throw new BadRequestError(
        `Vendor ${store.store_name} cannot receive online payments`
      );
    }

    return store;
  }

  /* -------------------------------------------------------------------------- */
  /* 🔥 3. CREATE ONLINE ORDER (PAYSTACK) — MULTI-VENDOR                        */
  /* -------------------------------------------------------------------------- */
  static async createOrderWithPaystack(data: {
    buyer_id: string;
    email: string;
    order_items: ICartItem[];
  }) {
    if (!data.order_items || data.order_items.length === 0)
      throw new BadRequestError("Order items required");

    const now = new Date().toISOString();

    const { validatedItems } = await this.buildOrderItems(data.order_items);

    const groups: Record<string, ICartItem[]> = {};
    for (const item of validatedItems) {
      const product = await ProductModel.findById(item.product_id);
      if (!groups[product.vendor_id]) groups[product.vendor_id] = [];
      groups[product.vendor_id].push(item);
    }

    const successfulOrders: Array<{ order: IOrder; paymentUrl: string }> = [];
    const failedVendors: Array<{ vendor_id: string; error: string }> = [];

    for (const vendor_id of Object.keys(groups)) {
      const vendorItems = groups[vendor_id];

      try {
        await this.validateVendorForOnline(vendor_id);

        let subtotal = 0;
        for (const item of vendorItems) {
          subtotal += (item.discount_price ?? item.price) * item.quantity;
        }

        const shipping_fee = 0;
        const tax = 0;
        const total = subtotal + shipping_fee + tax;

        const paymentInit = await initializePaystackPayment(data.email, total);

        const order = await OrderModel.create({
          id: uuidv4(),
          buyer_id: data.buyer_id,
          vendor_id,
          order_items: vendorItems,
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
          notes: null,
          created_at: now,
          updated_at: now,
        });

        await ServiceCache.clear("svc:order");

        try {
          const buyer = await UserModel.findById(data.buyer_id).catch(
            () => null
          );
          const vendor = await UserModel.findById(vendor_id).catch(() => null);

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
          console.error("Order creation email error:", err);
        }

        const escrow = await EscrowService.createEscrow({
          order_id: order.id,
          buyer_id: data.buyer_id,
          vendor_id,
          amount: total,
        });

        await OrderModel.update(order.id, { escrow_id: escrow.id });

        successfulOrders.push({
          order,
          paymentUrl: paymentInit.authorization_url,
        });
      } catch (err: any) {
        console.error(`Vendor ${vendor_id} failed: `, err.message);

        failedVendors.push({
          vendor_id,
          error: err.message || "Unknown error",
        });

        continue;
      }
    }

    return {
      success: true,
      successfulOrders,
      failedVendors,
    };
  }

  /* -------------------------------------------------------------------------- */
  /* 🔥 4. VERIFY PAYMENT                                                       */
  /* -------------------------------------------------------------------------- */
  static async verifyPayment(reference: string) {
    const order = await OrderModel.findOne({ payment_reference: reference });
    if (!order) throw new NotFoundError("Order not found");

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
    if (Number(amountPaid) !== Number(order.total)) {
      throw new BadRequestError("Amount mismatch");
    }

    const now = new Date().toISOString();

    const updatedOrder = await OrderModel.update(order.id, {
      status: "paid",
      payment_status: "success",
      updated_at: now,
    });

    await ServiceCache.clear("svc:order");

    await EscrowService.fundEscrow(updatedOrder.escrow_id!);

    await DeliveryService.createDelivery({
      order_id: order.id,
      buyer_id: order.buyer_id,
      vendor_id: order.vendor_id,
    });

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
      message: "Payment verified",
      order: updatedOrder,
    };
  }

  /* -------------------------------------------------------------------------- */
  /* 🔥 5. HANDLE PAYSTACK WEBHOOK                                              */
  /* -------------------------------------------------------------------------- */
  static async handlePaystackWebhook(data: any): Promise<void> {
    const reference = data.reference;

    if (!reference) {
      console.error("Webhook missing reference");
      return;
    }

    const order = await OrderModel.findOne({ payment_reference: reference });

    if (!order) {
      console.log("Order not found for webhook reference:", reference);
      return;
    }

    if (order.payment_status === "success") {
      console.log("Duplicate webhook — already processed.");
      return;
    }

    const amountPaid = Number(data.amount) / 100;
    const expectedAmount = Number(order.total);

    if (amountPaid !== expectedAmount) {
      console.error(
        `SECURITY ALERT: Webhook mismatch. Paid ${amountPaid}, expected ${expectedAmount}`
      );
      return;
    }

    const now = new Date().toISOString();

    await OrderModel.update(order.id, {
      status: "paid",
      payment_status: "success",
      updated_at: now,
    });

    await ServiceCache.clear("svc:order");

    if (order.escrow_id) {
      await EscrowService.fundEscrow(order.escrow_id);
    }

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
      type: "payment_webhook",
      amount: expectedAmount,
      currency: "NGN",
      reference,
      status: "success",
      description: "Payment confirmed by webhook",
      metadata: data,
      created_at: now,
      updated_at: now,
    });

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
      console.error("Webhook email error:", err);
    }

    console.log("Webhook completed for order:", order.id);
  }

  /* -------------------------------------------------------------------------- */
  /* 6. GET ORDERS (CACHED)                                                     */
  /* -------------------------------------------------------------------------- */
  static async getOrder(id: string): Promise<IOrder> {
    const key = ServiceCache.key("order", "single", id);

    const cached = await ServiceCache.get<IOrder>(key);
    if (cached) return cached;

    const order = await OrderModel.findById(id);
    if (!order) throw new NotFoundError("Order not found");

    await ServiceCache.set(key, order);
    return order;
  }

  static async getOrdersByUser(buyer_id: string) {
    const key = ServiceCache.key("order", "user", buyer_id);

    const cached = await ServiceCache.get<IOrder[]>(key);
    if (cached) return cached;

    const { data } = await OrderModel.findAll({ buyer_id });

    await ServiceCache.set(key, data);
    return data;
  }

  static async getOrdersByVendor(vendor_id: string) {
    const key = ServiceCache.key("order", "vendor", vendor_id);

    const cached = await ServiceCache.get<IOrder[]>(key);
    if (cached) return cached;

    const { data } = await OrderModel.findAll({ vendor_id });

    await ServiceCache.set(key, data);
    return data;
  }

  /* -------------------------------------------------------------------------- */
  /* 7. UPDATE ORDER STATUS                                                     */
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

    await ServiceCache.clear("svc:order");

    if (status === "delivered" && order.payment_method === "online") {
      await EscrowService.markDelivered(order.id);
    }

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
      console.error("Status update email error:", err);
    }

    return updated;
  }

  /* -------------------------------------------------------------------------- */
  /* 8. CANCEL ORDER                                                             */
  /* -------------------------------------------------------------------------- */
  static async cancelOrder(id: string, requestedBy: string) {
    const order = await OrderModel.findById(id);
    if (!order) throw new NotFoundError("Order not found");

    if (requestedBy !== order.buyer_id && requestedBy !== order.vendor_id) {
      throw new BadRequestError(
        "Only the buyer or vendor can cancel this order"
      );
    }

    if (["delivered", "completed"].includes(order.status)) {
      throw new BadRequestError(
        "Delivered or completed orders cannot be canceled"
      );
    }

    if (order.status === "canceled") {
      return {
        success: true,
        idempotent: true,
        message: "Order already canceled",
      };
    }

    const now = new Date().toISOString();

    await OrderModel.update(id, {
      status: "canceled",
      updated_at: now,
    });

    await ServiceCache.clear("svc:order");

    const delivery = await DeliveryModel.findOne({ order_id: order.id });

    if (
      delivery &&
      delivery.delivery_status !== "failed" &&
      delivery.delivery_status !== "returned"
    ) {
      await DeliveryModel.update(delivery.id, {
        delivery_status: "failed",
        updated_at: now,
      });
    }

    if (order.escrow_id && order.payment_method === "online") {
      try {
        await EscrowService.refundEscrow(order.escrow_id, requestedBy);
      } catch (err) {
        console.error("Refund error:", err);
      }
    }

    await TransactionModel.create({
      id: uuidv4(),
      order_id: order.id,
      escrow_id: order.escrow_id,
      user_id: order.buyer_id,
      vendor_id: order.vendor_id,
      type: "order_canceled",
      amount: order.total,
      currency: "NGN",
      status: "success",
      description: "Order canceled",
      metadata: null,
      created_at: now,
      updated_at: now,
    });

    try {
      const buyer = await UserModel.findById(order.buyer_id).catch(() => null);
      const vendor = await UserModel.findById(order.vendor_id).catch(
        () => null
      );

      if (buyer?.email) {
        await OrderMailService.sendOrderCanceled({
          email: buyer.email,
          name: buyer.first_name ?? "Customer",
          order,
        });
      }

      if (vendor?.email) {
        await OrderMailService.sendOrderCanceled({
          email: vendor.email,
          name: vendor.first_name ?? vendor.store_name ?? "Vendor",
          order,
        });
      }
    } catch (err) {
      console.error("Cancel email error:", err);
    }

    return {
      success: true,
      idempotent: false,
      message: "Order canceled successfully",
    };
  }
}
