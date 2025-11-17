import { sendEmail } from "./sendEmail.js";

export class DeliveryMailService {
  /* ----------------------------------------------------
       COMMON TEMPLATE WRAPPER
  ---------------------------------------------------- */
  private static wrapTemplate(title: string, content: string) {
    return `
      <div style="font-family: Arial; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="text-align:center; color:#333;">${title}</h2>
        <div style="margin-top:20px; color:#444;">${content}</div>
        <p style="font-size: 12px; color:#999; text-align:center; margin-top:30px;">
          © ${new Date().getFullYear()} EasyStore. All rights reserved.
        </p>
      </div>
    `;
  }

  /* ====================================================
       1) DELIVERY CREATED
  ====================================================== */

  // ➤ Buyer
  static async sendDeliveryCreatedBuyer({ email, name, order_id }: any) {
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>Your order <b>#${order_id}</b> is now being processed for delivery.</p>
      <p>We will keep you updated along the way.</p>
    `;

    await sendEmail({
      to: email,
      subject: "Your Delivery Has Started",
      html: this.wrapTemplate("Delivery Started", content),
    });
  }

  // ➤ Vendor
  static async sendDeliveryCreatedVendor({ email, name, order_id }: any) {
    const content = `
      <p>Hello <b>${name}</b>,</p>
      <p>A delivery has been created for order <b>#${order_id}</b>.</p>
      <p>Please prepare the package for pickup.</p>
    `;

    await sendEmail({
      to: email,
      subject: "Delivery Created for Your Order",
      html: this.wrapTemplate("Delivery Created", content),
    });
  }

  /* ====================================================
       2) COURIER ASSIGNED
  ====================================================== */

  // ➤ Buyer
  static async sendCourierAssignedBuyer({
    email,
    name,
    order_id,
    courier_id,
  }: any) {
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>A courier has been assigned to your delivery for order <b>#${order_id}</b>.</p>
      <p>Courier ID: <b>${courier_id}</b></p>
    `;

    await sendEmail({
      to: email,
      subject: "Courier Assigned to Your Delivery",
      html: this.wrapTemplate("Courier Assigned", content),
    });
  }

  // ➤ Vendor
  static async sendCourierAssignedVendor({
    email,
    name,
    order_id,
    courier_id,
  }: any) {
    const content = `
      <p>Hello <b>${name}</b>,</p>
      <p>A courier has been assigned to deliver order <b>#${order_id}</b>.</p>
      <p>Courier ID: <b>${courier_id}</b></p>
    `;

    await sendEmail({
      to: email,
      subject: "Courier Assigned",
      html: this.wrapTemplate("Courier Assigned", content),
    });
  }

  /* ====================================================
       3) DELIVERY STATUS UPDATED
  ====================================================== */

  // ➤ Buyer
  static async sendDeliveryStatusUpdateBuyer({
    email,
    name,
    order_id,
    status,
  }: any) {
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>Your delivery for order <b>#${order_id}</b> has been updated to:</p>
      <h2 style="text-align:center;">${status}</h2>
    `;

    await sendEmail({
      to: email,
      subject: "Delivery Status Updated",
      html: this.wrapTemplate("Delivery Update", content),
    });
  }

  // ➤ Vendor
  static async sendDeliveryStatusUpdateVendor({
    email,
    name,
    order_id,
    status,
  }: any) {
    const content = `
      <p>Hello <b>${name}</b>,</p>
      <p>The delivery status for order <b>#${order_id}</b> has been updated to:</p>
      <h2 style="text-align:center;">${status}</h2>
    `;

    await sendEmail({
      to: email,
      subject: "Delivery Status Updated",
      html: this.wrapTemplate("Delivery Update", content),
    });
  }

  /* ====================================================
       4) DELIVERY MARKED DELIVERED
  ====================================================== */

  // ➤ Buyer
  static async sendDeliveryDeliveredBuyer({ email, name, order_id }: any) {
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>Your package for order <b>#${order_id}</b> has been marked as <b>delivered</b>.</p>
      <p>Please confirm delivery in the EasyStore app.</p>
    `;

    await sendEmail({
      to: email,
      subject: "Package Delivered",
      html: this.wrapTemplate("Delivery Delivered", content),
    });
  }

  // ➤ Vendor
  static async sendDeliveryDeliveredVendor({ email, name, order_id }: any) {
    const content = `
      <p>Hello <b>${name}</b>,</p>
      <p>The package for order <b>#${order_id}</b> has been marked as delivered.</p>
      <p>Waiting for customer confirmation.</p>
    `;

    await sendEmail({
      to: email,
      subject: "Order Delivered",
      html: this.wrapTemplate("Delivery Delivered", content),
    });
  }

  /* ====================================================
       5) DELIVERY CONFIRMED (Escrow Released)
  ====================================================== */

  // ➤ Buyer
  static async sendDeliveryConfirmedBuyer({ email, name, order_id }: any) {
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>Delivery for order <b>#${order_id}</b> has been confirmed.</p>
      <p>Thank you for shopping with EasyStore.</p>
    `;

    await sendEmail({
      to: email,
      subject: "Delivery Confirmed",
      html: this.wrapTemplate("Delivery Confirmed", content),
    });
  }

  // ➤ Vendor
  static async sendDeliveryConfirmedVendor({ email, name, order_id }: any) {
    const content = `
      <p>Hello <b>${name}</b>,</p>
      <p>Delivery for order <b>#${order_id}</b> has been confirmed by the customer.</p>
      <p>Escrow payment has been released to you.</p>
    `;

    await sendEmail({
      to: email,
      subject: "Delivery Confirmed — Escrow Released",
      html: this.wrapTemplate("Escrow Released", content),
    });
  }

  /* ====================================================
       6) PROOF OF DELIVERY UPLOADED (Buyer Only)
  ====================================================== */

  static async sendProofUploadedBuyer({ email, name, order_id }: any) {
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>A proof of delivery has been uploaded for order <b>#${order_id}</b>.</p>
      <p>You can review it in the EasyStore app.</p>
    `;

    await sendEmail({
      to: email,
      subject: "Proof of Delivery Uploaded",
      html: this.wrapTemplate("Proof of Delivery", content),
    });
  }

  static async sendReleaseCodeToBuyer({
    email,
    name,
    order_id,
    release_code,
  }: any) {
    const content = `
    <p>Hi <b>${name}</b>,</p>
    <p>Your delivery for order <b>#${order_id}</b> has arrived.</p>
    <p>Your confirmation code is:</p>
    <h2 style="text-align:center;">${release_code}</h2>
    <p>Give this code ONLY to the courier/vendor when receiving your item.</p>
  `;

    await sendEmail({
      to: email,
      subject: "Your Delivery Confirmation Code",
      html: this.wrapTemplate("Delivery Code", content),
    });
  }
}
