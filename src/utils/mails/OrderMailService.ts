import { sendEmail } from "./sendEmail.js";

export class OrderMailService {
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

  /* ----------------------------------------------------
     1) ORDER CREATED (Buyer)
  ---------------------------------------------------- */
  static async sendOrderCreated({ email, name, order }: any) {
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>Your order <b>#${order.id}</b> has been created successfully.</p>
      <p>Status: <b>${order.status}</b></p>
      <p>Total: <b>₦${order.total_amount}</b></p>
    `;

    await sendEmail({
      to: email,
      subject: "Your EasyStore Order Has Been Created",
      html: this.wrapTemplate("Order Created", content),
    });
  }

  /* ----------------------------------------------------
     2) ORDER CREATED (Vendor Alert)
  ---------------------------------------------------- */
  static async sendVendorNewOrder({ email, name, order }: any) {
    const content = `
      <p>Hello <b>${name}</b>,</p>
      <p>You received a new order <b>#${order.id}</b> from a customer.</p>
      <p>Total: <b>₦${order.total_amount}</b></p>
    `;

    await sendEmail({
      to: email,
      subject: "New Order Received",
      html: this.wrapTemplate("New Order Alert", content),
    });
  }

  /* ----------------------------------------------------
     3) PAYMENT INITIALIZED (NO LINKS SENT)
  ---------------------------------------------------- */
  static async sendPaymentInitialized({ email, name, order }: any) {
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>Your payment process for order <b>#${order.id}</b> has been initialized.</p>
      <p>You can complete the payment on the EasyStore app.</p>
    `;

    await sendEmail({
      to: email,
      subject: "Payment Started",
      html: this.wrapTemplate("Payment Started", content),
    });
  }

  /* ----------------------------------------------------
     4) PAYMENT VERIFIED (Buyer)
  ---------------------------------------------------- */
  static async sendPaymentVerified({ email, name, order }: any) {
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>Your payment for order <b>#${order.id}</b> has been confirmed.</p>
      <p>Status is now: <b>${order.status}</b></p>
    `;

    await sendEmail({
      to: email,
      subject: "Payment Verified",
      html: this.wrapTemplate("Payment Verified", content),
    });
  }

  /* ----------------------------------------------------
     5) PAYMENT VERIFIED (Vendor)
  ---------------------------------------------------- */
  static async sendVendorPaymentVerified({ email, name, order }: any) {
    const content = `
      <p>Hello <b>${name}</b>,</p>
      <p>Payment for order <b>#${order.id}</b> has been confirmed.</p>
      <p>Please prepare the order for delivery.</p>
    `;

    await sendEmail({
      to: email,
      subject: "Order Payment Confirmed",
      html: this.wrapTemplate("Payment Confirmed", content),
    });
  }

  /* ----------------------------------------------------
     6) ORDER STATUS UPDATED
  ---------------------------------------------------- */
  static async sendOrderStatusUpdate({ email, name, order, status }: any) {
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>Your order <b>#${order.id}</b> status has been updated to:</p>
      <h2 style="text-align:center;">${status}</h2>
    `;

    await sendEmail({
      to: email,
      subject: "Order Status Updated",
      html: this.wrapTemplate("Order Update", content),
    });
  }

  /* ----------------------------------------------------
     7) ORDER CANCELED
  ---------------------------------------------------- */
  static async sendOrderCanceled({ email, name, order }: any) {
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>Your order <b>#${order.id}</b> has been cancelled.</p>
    `;

    await sendEmail({
      to: email,
      subject: "Order Cancelled",
      html: this.wrapTemplate("Order Cancelled", content),
    });
  }
}
