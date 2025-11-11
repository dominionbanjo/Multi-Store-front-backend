import { v4 as uuidv4 } from "uuid";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";
import {
  DeliveryModel,
  IDelivery,
  DeliveryStatus,
} from "../config/db/models/DeliveryModel.js";
import { OrderModel, OrderStatus } from "../config/db/models/OrderModel.js";
import { EscrowService } from "./escrowService.js";

/**
 * 🚚 Delivery Service
 * Handles creation, courier assignment, status updates, and escrow release.
 */
export class DeliveryService {
  /** ➕ Create a new delivery record */
  static async createDelivery(data: {
    order_id: string;
    buyer_id: string;
    vendor_id: string;
    courier_id?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    postal_code?: string | null;
    tracking_number?: string | null;
    estimated_delivery?: string | null;
  }): Promise<IDelivery> {
    const { order_id, buyer_id, vendor_id } = data;

    if (!order_id || !buyer_id || !vendor_id)
      throw new BadRequestError("Missing required delivery fields");

    const delivery = await DeliveryModel.create({
      id: uuidv4(),
      order_id,
      buyer_id,
      vendor_id,
      courier_id: data.courier_id || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      country: data.country || null,
      postal_code: data.postal_code || null,
      tracking_number: data.tracking_number || null,
      estimated_delivery: data.estimated_delivery || null,
      delivery_status: "pending" as DeliveryStatus,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return delivery;
  }

  /** 📦 Fetch a single delivery by ID */
  static async getDelivery(id: string): Promise<IDelivery> {
    const delivery = await DeliveryModel.findById(id);
    if (!delivery) throw new NotFoundError("Delivery not found");
    return delivery;
  }

  /** 👷 Assign courier to a delivery */
  static async assignCourier(delivery_id: string, courier_id: string) {
    const delivery = await DeliveryModel.findById(delivery_id);
    if (!delivery) throw new NotFoundError("Delivery not found");

    const updated = await DeliveryModel.update(delivery_id, {
      courier_id,
      delivery_status: "assigned" as DeliveryStatus,
      updated_at: new Date().toISOString(),
    });

    return updated;
  }

  /** 🔄 Update delivery status */
  static async updateStatus(delivery_id: string, status: DeliveryStatus) {
    const delivery = await DeliveryModel.findById(delivery_id);
    if (!delivery) throw new NotFoundError("Delivery not found");

    await DeliveryModel.update(delivery_id, {
      delivery_status: status,
      updated_at: new Date().toISOString(),
    });

    // 🧠 Auto-update related order & escrow if delivered
    if (status === "delivered" && delivery.order_id) {
      await EscrowService.markDelivered(delivery.order_id);
      await OrderModel.update(delivery.order_id, {
        status: "delivered" as OrderStatus,
        updated_at: new Date().toISOString(),
      });
    }

    return { success: true, message: "Delivery status updated successfully" };
  }

  /** ✅ Confirm delivery and release escrow funds */
  static async confirmDelivery(order_id: string, code: string) {
    const order = await OrderModel.findById(order_id);
    if (!order) throw new NotFoundError("Order not found");

    const delivery = await DeliveryModel.findOne({ order_id });
    if (!delivery) throw new NotFoundError("Delivery not found");

    await DeliveryModel.update(delivery.id, {
      delivery_status: "confirmed" as DeliveryStatus,
      delivered_at: new Date().toISOString(),
    });

    // 💸 Release escrow to vendor
    return await EscrowService.releaseEscrow(order_id, code);
  }

  /** 🧾 Upload proof of delivery (image, doc, etc.) */
  static async uploadProof(delivery_id: string, url: string) {
    const delivery = await DeliveryModel.findById(delivery_id);
    if (!delivery) throw new NotFoundError("Delivery not found");

    const updated = await DeliveryModel.update(delivery_id, {
      proof_of_delivery_url: url,
      updated_at: new Date().toISOString(),
    });

    return updated;
  }
}
