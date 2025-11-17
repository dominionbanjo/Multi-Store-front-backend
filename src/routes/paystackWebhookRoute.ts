import { Router } from "express";
import { PaystackWebhookController } from "../webhooks/paystackWebhook.js";

const router = Router();

// RAW body route only
router.post("/", PaystackWebhookController.handleWebhook);

export default router;
