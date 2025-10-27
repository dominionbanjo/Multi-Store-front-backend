import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";
import { requestContext } from "../utils/contexts/context.js";

export const contextMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  // pull from auth if available, otherwise fallback
  const user = (req as any).user || {
    id: "guest",
    name: "Guest",
    role: "guest",
  };

  const context = {
    user,
    requestId: randomUUID(),
  };

  requestContext.run(context, next);
};
