import { Request, Response } from "express";
import crypto from "crypto";
import { OrderService } from "../services/orderService.js";
import PayoutService from "../services/payoutService.js";
import { OrderModel } from "../config/db/models/OrderModel.js";

export class PaystackWebhookController {
  static async handleWebhook(req: Request, res: Response): Promise<Response> {
    try {
      const signature = req.headers["x-paystack-signature"];
      const secret = process.env.PAYSTACK_SECRET_KEY;

      if (!signature || !secret)
        return res.status(400).send("Missing webhook signature or secret");

      // Raw body hash check
      const computedHash = crypto
        .createHmac("sha512", secret)
        .update(req.body)
        .digest("hex");

      if (computedHash !== signature)
        return res.status(401).send("Invalid Paystack signature");

      const event = JSON.parse(req.body.toString());
      const data = event?.data;

      if (!event?.event) {
        console.log("Webhook: Missing event type");
        return res.sendStatus(200);
      }

      const eventName = event.event;

      /* ----------------------------------------------------------------------
       *  PAYMENT WEBHOOK: charge.success
       * --------------------------------------------------------------------*/
      if (eventName === "charge.success") {
        const reference = data?.reference;

        const order = await OrderModel.findOne({
          payment_reference: reference,
        });
        if (!order) return res.sendStatus(200);

        // AMOUNT VALIDATION
        const amountPaid = data.amount / 100;
        if (amountPaid !== order.total) {
          console.error(
            `SECURITY ALERT: Webhook amount mismatch for ${order.id}. Paid ${amountPaid}, expected ${order.total}`
          );
          return res.sendStatus(200);
        }

        await OrderService.handlePaystackWebhook(data);
        return res.sendStatus(200);
      }

      /* ----------------------------------------------------------------------
       *  PAYOUT WEBHOOKS
       * --------------------------------------------------------------------*/
      const transferCode =
        data?.transfer_code ||
        data?.transfer_code?.trim?.() ||
        data?.transfer?.transfer_code;

      // no transfer token → ignore
      if (eventName.startsWith("transfer.") && !transferCode) {
        console.log("Webhook missing transfer_code, event:", eventName);
        return res.sendStatus(200);
      }

      /* --------------------- transfer.success ------------------------------- */
      if (eventName === "transfer.success") {
        console.log("Webhook: transfer.success", transferCode);

        await PayoutService.markSuccess(transferCode, data);
        return res.sendStatus(200);
      }

      /* --------------------- transfer.failed -------------------------------- */
      if (eventName === "transfer.failed") {
        console.log("Webhook: transfer.failed", transferCode);

        await PayoutService.markFailed(transferCode, data);
        return res.sendStatus(200);
      }

      /* --------------------- transfer.reversed ------------------------------ */
      if (eventName === "transfer.reversed") {
        console.log("Webhook: transfer.reversed", transferCode);

        await PayoutService.markReversed(transferCode, data);
        return res.sendStatus(200);
      }

      /* --------------------- refund.success -------------------------------- */
      if (eventName === "refund.success") {
        const refundCode =
          data?.transfer_code ||
          data?.transfer?.transfer_code ||
          data?.refund?.reference;

        if (refundCode) {
          console.log("Webhook: refund.success", refundCode);
          await PayoutService.markSuccess(refundCode, data);
        }

        return res.sendStatus(200);
      }

      return res.sendStatus(200);
    } catch (err) {
      console.error("Webhook error:", err);
      return res.sendStatus(500);
    }
  }
}
