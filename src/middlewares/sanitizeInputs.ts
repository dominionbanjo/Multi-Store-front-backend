import { Request, Response, NextFunction } from "express";
import xss from "xss";

/** Recursively sanitize strings in an object */
const sanitize = (input: any): any => {
  if (typeof input === "string") {
    return xss(input);
  } else if (Array.isArray(input)) {
    return input.map(sanitize);
  } else if (typeof input === "object" && input !== null) {
    for (const key in input) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        input[key] = sanitize(input[key]);
      }
    }
  }
  return input;
};

/** Express-safe sanitizer middleware (does not reassign req.query/params) */
export const sanitizeInput = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (req.body) sanitize(req.body); // ✅ mutate in place
  if (req.query) sanitize(req.query); // ✅ no reassignment
  if (req.params) sanitize(req.params); // ✅ no reassignment
  next();
};
