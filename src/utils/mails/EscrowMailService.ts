import { sendEmail } from "./sendEmail.js";

export class EscrowMailService {
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

  /* --------------------------------------------------------------------------
        1. ESCROW CREATED (Buyer) – after order created w/ online payment
  -------------------------------------------------------------------------- */
  static async sendEscrowCreatedBuyer({ email, name, order_id }: any) {
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>An escrow has been created for your order <b>#${order_id}</b>.</p>
      <p>Your money is safely held and will only be released after you confirm delivery.</p>
    `;

    await sendEmail({
      to: email,
      subject: "Escrow Created",
      html: this.wrapTemplate("Escrow Created", content),
    });
  }

  /* --------------------------------------------------------------------------
        2. ESCROW CREATED (Vendor)
  -------------------------------------------------------------------------- */
  static async sendEscrowCreatedVendor({ email, name, order_id, amount }: any) {
    const content = `
      <p>Hello <b>${name}</b>,</p>
      <p>An escrow has been created for order <b>#${order_id}</b>.</p>
      <p>You will receive ₦${amount} after the customer confirms delivery.</p>
    `;

    await sendEmail({
      to: email,
      subject: "Escrow Started For Your Order",
      html: this.wrapTemplate("Escrow Created", content),
    });
  }

  /* --------------------------------------------------------------------------
        3. ESCROW FUNDED (Buyer)
  -------------------------------------------------------------------------- */
  static async sendEscrowFundedBuyer({ email, name, order_id }: any) {
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>Your payment for order <b>#${order_id}</b> has been secured in escrow.</p>
      <p>Your money is protected until you confirm delivery.</p>
    `;

    await sendEmail({
      to: email,
      subject: "Escrow Funded",
      html: this.wrapTemplate("Escrow Funded", content),
    });
  }

  /* --------------------------------------------------------------------------
        4. ESCROW FUNDED (Vendor)
  -------------------------------------------------------------------------- */
  static async sendEscrowFundedVendor({ email, name, order_id }: any) {
    const content = `
      <p>Hello <b>${name}</b>,</p>
      <p>The payment for order <b>#${order_id}</b> has been funded and held in escrow.</p>
      <p>You will receive the funds once delivery is confirmed.</p>
    `;

    await sendEmail({
      to: email,
      subject: "Escrow Funded",
      html: this.wrapTemplate("Escrow Funded", content),
    });
  }

  /* --------------------------------------------------------------------------
        5. ESCROW RELEASED (Vendor Gets Paid)
  -------------------------------------------------------------------------- */
  static async sendEscrowReleasedVendor({
    email,
    name,
    order_id,
    amount,
  }: any) {
    const content = `
      <p>Hello <b>${name}</b>,</p>
      <p>Your payment for order <b>#${order_id}</b> has been released!</p>
      <p>₦${amount} has been transferred to your payout account.</p>
    `;

    await sendEmail({
      to: email,
      subject: "Payment Released",
      html: this.wrapTemplate("Escrow Released", content),
    });
  }

  /* --------------------------------------------------------------------------
        6. ESCROW REFUNDED (Buyer)
  -------------------------------------------------------------------------- */
  static async sendEscrowRefundedBuyer({ email, name, order_id, amount }: any) {
    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>Your order <b>#${order_id}</b> has been cancelled.</p>
      <p>Your payment of ₦${amount} has been refunded.</p>
    `;

    await sendEmail({
      to: email,
      subject: "Refund Processed",
      html: this.wrapTemplate("Refund Issued", content),
    });
  }
}
