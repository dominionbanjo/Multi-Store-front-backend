import { validationResult, ValidationChain } from "express-validator";
import { Request, Response, NextFunction } from "express";

export const withValidationErrors = (validators: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validators.map((v) => v.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors
        .array()
        .map((err) => err.msg)
        .join(", ");
      return res.status(400).json({ message: errorMessages });
    }

    next();
  };
};
