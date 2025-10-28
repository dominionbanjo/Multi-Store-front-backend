import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { StatusCodes } from "http-status-codes";
import sql from "../config/connect.js";
import { createJWT } from "../utils/auth/tokenUtil.js";
import { v4 as uuidv4 } from "uuid";
import { BadRequestError } from "../utils/errors/customError.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const continueWithGoogle = async (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token) throw new BadRequestError("Missing Google token");

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) throw new BadRequestError("Invalid Google token");

    const { email, name, picture, email_verified } = payload;

    if (!email) throw new BadRequestError("Google account has no email");
    if (!name)
      throw new BadRequestError("Google account has no name information");

    const nameParts = name.trim().split(" ");
    if (nameParts.length < 2) {
      throw new BadRequestError(
        "Full name (first and last) is required from your Google account"
      );
    }

    const [firstName, lastName] = nameParts;

    const existing = await sql`SELECT * FROM users WHERE email = ${email}`;
    let user = existing[0];

    if (!user) {
      const id = uuidv4();
      const accountType = "user";
      const agree_to_terms = true;

      await sql`
        INSERT INTO users (
          id, first_name, last_name, email, email_verified, account_type, agree_to_terms
        )
        VALUES (
          ${id}, ${firstName}, ${lastName}, ${email}, ${
        email_verified ?? true
      }, ${accountType}, ${agree_to_terms}
        )
      `;

      const result = await sql`SELECT * FROM users WHERE id = ${id}`;
      user = result[0];
    }

    const jwt = createJWT({
      userId: user.id,
      name: user.first_name,
      role: user.account_type,
    });

    res.status(StatusCodes.OK).json({
      status: 1,
      success: true,
      message: user ? "Login successful" : "Account created successfully",
      token: jwt,
      user: {
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        account_type: user.account_type,
        avatar: picture,
      },
    });
  } catch (error: any) {
    console.error("Google OAuth Error:", error);
    res.status(StatusCodes.UNAUTHORIZED).json({
      status: 0,
      success: false,
      message: "Google authentication failed",
      error: error.message,
    });
  }
};
