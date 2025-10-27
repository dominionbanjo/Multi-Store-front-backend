import { Request, Response, NextFunction } from "express";
import {
  UnauthenticatedError,
  UnauthorizedError,
} from "../utils/errors/customError.js";
import { verifyJWT } from "../utils/auth/tokenUtil.js";

interface CustomRequest extends Request {
  user?: {
    userId: string;
    name: string;
    role: string;
  };
}

export const authenticateUser = (
  req: CustomRequest,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthenticatedError("Authentication invalid — token missing");
  }

  const token = authHeader.split(" ")[1];

  try {
    const { userId, name, role } = verifyJWT(token);
    req.user = { userId, name, role };
    next();
  } catch {
    throw new UnauthenticatedError("Authentication invalid — invalid token");
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
