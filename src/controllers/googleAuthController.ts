import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { createJWT } from "../utils/auth/tokenUtil.js";
import { BadRequestError } from "../utils/errors/customError.js";
import Accounts from "../services/accountsService.js";

export const continueWithGoogle = async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) throw new BadRequestError("Missing Google token");

  try {
    const user = await Accounts.continueWithGoogle(token);

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
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        account_type: user.account_type,
        avatar: user.avatar,
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
