import { v4 as uuidv4 } from "uuid";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";
import {
  DeliveryModel,
  IDelivery,
  DeliveryStatus,
} from "../config/db/models/DeliveryModel.js";
import { OrderModel } from "../config/db/models/OrderModel.js";
import { EscrowService } from "./escrowService.js";
import { DeliveryMailService } from "../utils/mails/DeliveryMailService.js";
import { UserModel } from "../config/db/models/UserModel.js";
import { EscrowModel } from "../config/db/models/EscrowModel.js";
import StoreService from "./storeService.js";
import UploadService from "./uploadService.js";

/**
 * 🚚 Delivery Service (Idempotent + Full Mail Notifications)
 */
export class DeliveryService {
  /* -------------------------------------------------------------------------- */
  /*                               1. CREATE DELIVERY                           */
  /* -------------------------------------------------------------------------- */
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

    // 🔁 Idempotent — delivery already exists
    const existing = await DeliveryModel.findOne({ order_id });
    if (existing) return existing;

    // 🧾 Fetch order to extract items
    const order = await OrderModel.findById(order_id);
    if (!order) throw new NotFoundError("Order not found");

    // 🔎 Fetch buyer + address
    const buyer = await UserModel.findById(buyer_id);
    if (!buyer) throw new BadRequestError("Buyer not found");

    const addr = buyer.address || {};

    const now = new Date().toISOString();

    const delivery = await DeliveryModel.create({
      id: uuidv4(),
      order_id,
      buyer_id,
      vendor_id,
      courier_id: data.courier_id ?? null,

      // 🛍 Store snapshot of the order items
      order_items: order.order_items,

      // 🏠 Auto-fill from buyer profile unless provided
      address: data.address ?? addr.street ?? null,
      city: data.city ?? addr.city ?? null,
      state: data.state ?? addr.state ?? null,
      country: data.country ?? addr.country ?? null,
      postal_code: data.postal_code ?? addr.postal_code ?? null,

      tracking_number: data.tracking_number ?? null,
      estimated_delivery: data.estimated_delivery ?? null,

      delivery_status: "pending",
      confirmation_code: null,
      proof_of_delivery_url: null,

      created_at: now,
      updated_at: now,
    });

    // Notify buyer + vendor
    const vendor = await UserModel.findById(vendor_id);

    if (buyer?.email) {
      await DeliveryMailService.sendDeliveryCreatedBuyer({
        email: buyer.email,
        name: buyer.first_name,
        order_id,
      });
    }

    if (vendor?.email) {
      await DeliveryMailService.sendDeliveryCreatedVendor({
        email: vendor.email,
        name: vendor.first_name ?? vendor.store_name ?? "Vendor",
        order_id,
      });
    }

    return delivery;
  }

  /* -------------------------------------------------------------------------- */
  /*                               2. GET DELIVERY                              */
  /* -------------------------------------------------------------------------- */
  static async getDelivery(id: string): Promise<IDelivery> {
    const delivery = await DeliveryModel.findById(id);
    if (!delivery) throw new NotFoundError("Delivery not found");
    return delivery;
  }

  /* -------------------------------------------------------------------------- */
  /*                               3. ASSIGN COURIER                            */
  /* -------------------------------------------------------------------------- */
  static async assignCourier(delivery_id: string, courier_id: string) {
    const delivery = await DeliveryModel.findById(delivery_id);
    if (!delivery) throw new NotFoundError("Delivery not found");

    if (delivery.courier_id === courier_id) return delivery;

    const updated = await DeliveryModel.update(delivery_id, {
      courier_id,
      delivery_status: "assigned",
      updated_at: new Date().toISOString(),
    });

    const order = await OrderModel.findById(delivery.order_id);
    const buyer = await UserModel.findById(order.buyer_id);
    const vendor = await UserModel.findById(order.vendor_id);

    if (buyer?.email) {
      await DeliveryMailService.sendCourierAssignedBuyer({
        email: buyer.email,
        name: buyer.first_name,
        order_id: delivery.order_id,
        courier_id,
      });
    }

    if (vendor?.email) {
      await DeliveryMailService.sendCourierAssignedVendor({
        email: vendor.email,
        name: vendor.first_name ?? vendor.store_name ?? "Vendor",
        order_id: delivery.order_id,
        courier_id,
      });
    }

    return updated;
  }

  /* -------------------------------------------------------------------------- */
  /*                               4. UPDATE STATUS                             */
  /* -------------------------------------------------------------------------- */
  static async updateStatus(
    delivery_id: string,
    status: DeliveryStatus,
    userId: string,
    role: string
  ) {
    const delivery = await DeliveryModel.findById(delivery_id);
    if (!delivery) throw new NotFoundError("Delivery not found");

    // 🚫 Ensure only vendor and admin can update status
    if (delivery.vendor_id !== userId && role !== "admin") {
      throw new BadRequestError(
        "Only the assigned vendor can update delivery status"
      );
    }

    const order = await OrderModel.findById(delivery.order_id);

    if (status === "confirmed") {
      throw new BadRequestError(
        "Only the vendor confirmation process can set status to confirmed"
      );
    }

    const FLOW: DeliveryStatus[] = [
      "pending",
      "assigned",
      "in_transit",
      "delivered",
      "confirmed",
      "failed",
      "returned",
    ];

    const currentIndex = FLOW.indexOf(delivery.delivery_status);
    const newIndex = FLOW.indexOf(status);

    if (newIndex < currentIndex && !["failed", "returned"].includes(status)) {
      throw new BadRequestError(
        `Cannot move delivery status backward from ${delivery.delivery_status} → ${status}`
      );
    }

    if (delivery.delivery_status === status) {
      return {
        success: true,
        idempotent: true,
        message: `Delivery already in status: ${status}`,
      };
    }

    await DeliveryModel.update(delivery_id, {
      delivery_status: status,
      updated_at: new Date().toISOString(),
    });

    const buyer = await UserModel.findById(order.buyer_id);
    const vendor = await UserModel.findById(order.vendor_id);

    if (buyer?.email) {
      await DeliveryMailService.sendDeliveryStatusUpdateBuyer({
        email: buyer.email,
        name: buyer.first_name,
        order_id: delivery.order_id,
        status,
      });
    }

    if (vendor?.email) {
      await DeliveryMailService.sendDeliveryStatusUpdateVendor({
        email: vendor.email,
        name: vendor.first_name ?? vendor.store_name ?? "Vendor",
        order_id: delivery.order_id,
        status,
      });
    }

    if (status === "delivered" && order.payment_method === "online") {
      if (!order.escrow_id)
        throw new BadRequestError("Escrow record missing for this order");

      const escrow = await EscrowModel.findById(order.escrow_id);
      if (!escrow) throw new NotFoundError("Escrow not found");

      if (buyer?.email) {
        await DeliveryMailService.sendReleaseCodeToBuyer({
          email: buyer.email,
          name: buyer.first_name,
          order_id: delivery.order_id,
          release_code: escrow.release_code,
        });
      }

      if (order.status !== "delivered") {
        await EscrowService.markDelivered(delivery.order_id);
        await OrderModel.update(delivery.order_id, {
          status: "delivered",
          updated_at: new Date().toISOString(),
        });
      }
    }

    return { success: true, message: "Delivery status updated successfully" };
  }

  /* -------------------------------------------------------------------------- */
  /*        5. CONFIRM DELIVERY (TRIGGERED BY VENDOR WITH BUYER'S CODE)         */
  /* -------------------------------------------------------------------------- */
  static async confirmDelivery(
    order_id: string,
    code: string,
    vendor_user: string
  ) {
    const order = await OrderModel.findById(order_id);
    if (!order) throw new NotFoundError("Order not found");

    // vendor must be the one confirming delivery
    if (vendor_user !== order.vendor_id) {
      throw new BadRequestError("Only vendor can confirm delivery");
    }

    const delivery = await DeliveryModel.findOne({ order_id });
    if (!delivery) throw new NotFoundError("Delivery not found");
    console.log(order);

    // if (delivery.delivery_status === "confirmed") {
    //   return {
    //     success: true,
    //     idempotent: true,
    //     message: "Delivery already confirmed",
    //   };
    // }

    await DeliveryModel.update(delivery.id, {
      delivery_status: "confirmed",
      delivered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const buyer = await UserModel.findById(order.buyer_id);
    const vendor = await UserModel.findById(order.vendor_id);

    if (buyer?.email) {
      await DeliveryMailService.sendDeliveryConfirmedBuyer({
        email: buyer.email,
        name: buyer.first_name,
        order_id,
      });
    }

    if (vendor?.email) {
      await DeliveryMailService.sendDeliveryConfirmedVendor({
        email: vendor.email,
        name: vendor.first_name ?? vendor.store_name ?? "Vendor",
        order_id,
      });
    }

    // vendor provides code buyer gave them
    return await EscrowService.releaseEscrow(order_id, code, order.buyer_id);
  }

  /* -------------------------------------------------------------------------- */
  /*                           6. UPLOAD PROOF                                  */
  /* -------------------------------------------------------------------------- */

  static async uploadProof(delivery_id: string, file?: Express.Multer.File) {
    if (!file) throw new BadRequestError("Proof image is required");

    const delivery = await DeliveryModel.findById(delivery_id);
    if (!delivery) throw new NotFoundError("Delivery not found");

    // Upload new proof
    const uploaded = await UploadService.uploadSingle(
      file,
      "easystore/delivery-proofs"
    );

    if (!uploaded?.url) {
      throw new BadRequestError("Failed to upload delivery proof");
    }

    // Delete old proof if exists
    if (delivery.proof_of_delivery_url) {
      const publicId = delivery.proof_of_delivery_url_public_id;
      if (publicId) {
        await UploadService.deleteSingle(publicId);
      }
    }

    // Save new proof
    const updated = await DeliveryModel.update(delivery_id, {
      proof_of_delivery_url: uploaded.url,
      proof_of_delivery_url_public_id: uploaded.public_id,
      updated_at: new Date().toISOString(),
    });

    // Notify buyer that proof was uploaded
    const order = await OrderModel.findById(delivery.order_id);
    const buyer = await UserModel.findById(order.buyer_id);

    if (buyer?.email) {
      await DeliveryMailService.sendProofUploadedBuyer({
        email: buyer.email,
        name: buyer.first_name,
        order_id: delivery.order_id,
      });
    }

    return {
      message: "Proof of delivery uploaded successfully",
      delivery: updated,
    };
  }
}
