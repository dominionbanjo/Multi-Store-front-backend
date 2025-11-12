// middlewares/withValidationErrors.ts
import { validationResult, ValidationChain } from "express-validator";
import { Request, Response, NextFunction } from "express";

export const withValidationErrors = (
  validators: ValidationChain[],
  allowedFields?: string[]
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run express-validator checks
    await Promise.all(validators.map((v) => v.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors
        .array()
        .map((err) => err.msg)
        .join(", ");
      return res.status(400).json({ success: false, message: errorMessages });
    }

    // ✅ Strict field validation
    if (allowedFields && req.body && Object.keys(req.body).length > 0) {
      const invalidFields = Object.keys(req.body).filter(
        (key) => !allowedFields.includes(key)
      );

      if (invalidFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Unexpected field(s): ${invalidFields.join(", ")}`,
        });
      }
    }

    next();
  };
};
