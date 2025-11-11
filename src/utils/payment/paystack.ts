import axios from "axios";
import { BadRequestError } from "../errors/customError.js";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const PAYSTACK_BASE_URL = "https://api.paystack.co";

const headers = {
  Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
  "Content-Type": "application/json",
};

/** 💳 Initialize payment */
export const initializePaystackPayment = async (
  email: string,
  amount: number
) => {
  const res = await axios.post(
    `${PAYSTACK_BASE_URL}/transaction/initialize`,
    {
      email,
      amount: Math.round(amount * 100),
      currency: "NGN",
    },
    { headers }
  );
  return res.data.data;
};

/** ✅ Verify payment */
export const verifyPaystackPayment = async (reference: string) => {
  const res = await axios.get(
    `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
    {
      headers,
    }
  );
  return res.data.data;
};

/** 🏦 Verify bank account */
export const verifyBankAccount = async (
  account_number: string,
  bank_code: string
) => {
  const res = await axios.get(
    `${PAYSTACK_BASE_URL}/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
    { headers }
  );
  return res.data.data; // { account_name, account_number, bank_id, ... }
};

/** 🧾 Create transfer recipient (one time per vendor) */
export const createTransferRecipient = async ({
  name,
  account_number,
  bank_code,
}: {
  name: string;
  account_number: string;
  bank_code: string;
}) => {
  const res = await axios.post(
    `${PAYSTACK_BASE_URL}/transferrecipient`,
    {
      type: "nuban",
      name,
      account_number,
      bank_code,
      currency: "NGN",
    },
    { headers }
  );

  return res.data.data.recipient_code;
};

/** 💸 Transfer funds from your Paystack balance to a vendor */
export const initiateTransfer = async ({
  recipient_code,
  amount,
  reason,
}: {
  recipient_code: string;
  amount: number;
  reason: string;
}) => {
  if (!recipient_code) throw new BadRequestError("Recipient code required");

  const res = await axios.post(
    `${PAYSTACK_BASE_URL}/transfer`,
    {
      source: "balance",
      amount: Math.round(amount * 100),
      recipient: recipient_code,
      reason,
    },
    { headers }
  );

  return res.data.data; // { transfer_code, status, ... }
};
