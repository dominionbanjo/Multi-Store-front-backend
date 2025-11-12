import SibApiV3Sdk from "sib-api-v3-sdk";
import * as dotenv from "dotenv";
dotenv.config();

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async ({ to, subject, html }: SendEmailOptions) => {
  try {
    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    const apiKey = defaultClient.authentications["api-key"];
    apiKey.apiKey = process.env.BREVO_API_KEY as string;

    const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

    const sender = {
      email: "dominionbanjo@gmail.com", // must be your verified sender in Brevo
      name: "easyStore",
    };

    const receivers = [{ email: to }];

    await tranEmailApi.sendTransacEmail({
      sender,
      to: receivers,
      subject,
      htmlContent: html,
    });
  } catch (error: any) {
    console.error(
      "❌ Email send error:",
      error.response?.text || error.message
    );
    throw new Error("Failed to send email, please try again later.");
  }
};
