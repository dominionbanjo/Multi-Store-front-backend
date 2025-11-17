import axios from "axios";
import { BadRequestError } from "../errors/customError.js";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const PAYSTACK_BASE_URL = "https://api.paystack.co";

const headers = {
  Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
  "Content-Type": "application/json",
};

/**
 * 🧾 Handle Paystack API errors gracefully
 */
const handlePaystackError = (error: any, context: string) => {
  const status = error.response?.status;
  const message =
    error.response?.data?.message ||
    error.message ||
    "An unknown error occurred with Paystack";

  if (status === 401)
    throw new BadRequestError(
      `Paystack authentication failed: Invalid API key`
    );
  if (status === 422)
    throw new BadRequestError(
      `${context} failed — invalid or unprocessable data`
    );
  if (status === 400)
    throw new BadRequestError(`${context} failed — bad request`);
  if (status === 404)
    throw new BadRequestError(`${context} failed — endpoint not found`);

  throw new BadRequestError(`${context} failed: ${message}`);
};

/**
 * 💳 Initialize payment
 */
export const initializePaystackPayment = async (
  email: string,
  amount: number
) => {
  try {
    const res = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        email,
        amount: Math.round(amount * 100),
        currency: "NGN",
        callback_url: `${process.env.BASE_URL}/verify`,
      },
      { headers }
    );
    return res.data.data;
  } catch (error: any) {
    handlePaystackError(error, "Payment initialization");
  }
};

/**
 * ✅ Verify payment
 */
export const verifyPaystackPayment = async (reference: string) => {
  try {
    const res = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      { headers }
    );
    return res.data.data;
  } catch (error: any) {
    handlePaystackError(error, "Payment verification");
  }
};

/**
 * 🏦 Verify bank account (with clear feedback)
 */

export const verifyBankAccount = async (
  account_number: string,
  bank_code: string
) => {
  try {
    // 1️⃣ Resolve account number
    const res = await axios.get(`${PAYSTACK_BASE_URL}/bank/resolve`, {
      headers,
      params: { account_number, bank_code },
    });

    const data = res.data?.data;
    if (!data || !data.account_name) {
      throw new BadRequestError(
        "Bank verification failed — invalid account details"
      );
    }

    // 2️⃣ Fetch actual bank name from Paystack bank list
    const bankListRes = await axios.get(`${PAYSTACK_BASE_URL}/bank`, {
      headers,
    });

    const bankList = bankListRes.data?.data || [];

    const bank = bankList.find((b: any) => b.code === bank_code);

    const bank_name = bank ? bank.name : "Unknown Bank";

    return {
      account_name: data.account_name,
      account_number: data.account_number,
      bank_id: data.bank_id,
      bank_name,
    };
  } catch (error: any) {
    throw new BadRequestError("Unable to verify bank account");
  }
};

/**
 * 🧾 Create transfer recipient (for verified vendor accounts)
 */
export const createTransferRecipient = async ({
  name,
  account_number,
  bank_code,
}: {
  name: string;
  account_number: string;
  bank_code: string;
}) => {
  try {
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

    const data = res.data?.data;

    if (!data?.recipient_code) {
      throw new BadRequestError("Unable to create Paystack transfer recipient");
    }

    return data.recipient_code;
  } catch (error: any) {
    handlePaystackError(error, "Transfer recipient creation");
  }
};

/**
 * 💸 Transfer funds from your Paystack balance to a vendor
 */
export const initiateTransfer = async ({
  recipient_code,
  amount,
  reason,
}: {
  recipient_code: string;
  amount: number;
  reason: string;
}) => {
  if (!recipient_code)
    throw new BadRequestError(
      "Recipient code required before initiating transfer"
    );

  try {
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

    return res.data?.data;
  } catch (error: any) {
    handlePaystackError(error, "Funds transfer");
  }
};
