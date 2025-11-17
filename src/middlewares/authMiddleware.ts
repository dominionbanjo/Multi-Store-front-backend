import { Request, Response, NextFunction } from "express";
import {
  UnauthenticatedError,
  UnauthorizedError,
} from "../utils/errors/customError.js";
import { verifyJWT } from "../utils/auth/tokenUtil.js";
import { UserModel } from "../config/db/models/UserModel.js";

interface CustomRequest extends Request {
  user?: {
    userId: string;
    name: string;
    role: string;
  };
}

export const authenticateUser = async (
  req: CustomRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthenticatedError("Authentication invalid — token missing");
  }

  const token = authHeader.split(" ")[1];

  try {
    // Decode JWT (now includes tokenVersion)
    const decoded = verifyJWT(token);

    const { userId, name, role, tokenVersion } = decoded as {
      userId: string;
      name: string;
      role: string;
      tokenVersion: number;
    };

    // Fetch the user from DB for version comparison
    const user = await UserModel.findOne({ id: userId });
    if (!user) {
      throw new UnauthenticatedError("User no longer exists");
    }

    // IMPORTANT: Compare token versions
    if (user.token_version !== tokenVersion) {
      throw new UnauthenticatedError("Token expired — please login again");
    }

    // Attach to request
    req.user = { userId, name, role };

    next();
  } catch (err) {
    throw new UnauthenticatedError("Authentication invalid");
  }
};

export const authorizePermissions = (...roles: string[]) => {
  return (req: CustomRequest, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new UnauthorizedError("Not authorized to access this route");
    }
    next();
  };
};
