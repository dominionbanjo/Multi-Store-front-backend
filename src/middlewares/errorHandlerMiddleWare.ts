import { StatusCodes } from "http-status-codes";
import { Request, Response, NextFunction } from "express";
import postgres from "postgres";

// ✅ Extend Express Error
interface CustomError extends Error {
  statusCode?: number;
  code?: string; // for Postgres error codes
  detail?: string;
}

// ✅ Centralized Error Handler
const errorHandlerMiddleWare = (
  err: CustomError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (process.env.NODE_ENV === "development") {
    console.error("🔥 Error caught:", err);
  }

  let statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  let msg = err.message || "Something went wrong. Please try again later.";

  /**
   * 🧩 Handle Postgres errors gracefully
   * Based on common error codes:
   * https://www.postgresql.org/docs/current/errcodes-appendix.html
   */
  if (
    err instanceof postgres.PostgresError ||
    (err.code && err.code.startsWith("22"))
  ) {
    switch (err.code) {
      case "22P02": // invalid_text_representation
        statusCode = StatusCodes.BAD_REQUEST;
        msg = "Invalid input syntax for the expected type.";
        break;
      case "23505": // unique_violation
        statusCode = StatusCodes.CONFLICT;
        msg = "Duplicate value violates unique constraint.";
        break;
      case "23503": // foreign_key_violation
        statusCode = StatusCodes.BAD_REQUEST;
        msg = "Invalid reference — related record not found.";
        break;
      case "23502": // not_null_violation
        statusCode = StatusCodes.BAD_REQUEST;
        msg = "Missing required field. Please check your input.";
        break;
      case "42601": // syntax_error
        statusCode = StatusCodes.BAD_REQUEST;
        msg = "SQL syntax error — check your query structure.";
        break;
      case "42804": // datatype_mismatch
        statusCode = StatusCodes.BAD_REQUEST;
        msg = "Data type mismatch in input or constraint.";
        break;
      case "42703": // undefined_column
        statusCode = StatusCodes.BAD_REQUEST;
        msg = "Invalid field or column name used.";
        break;
      case "42P01": // undefined_table
        statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
        msg = "Database table not found.";
        break;
      default:
        statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
        msg = err.detail || "Unexpected database error.";
        break;
    }
  }

  // 🧠 Return clean JSON
  res.status(statusCode).json({
    success: false,
    message: msg,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export default errorHandlerMiddleWare;

// import { StatusCodes } from "http-status-codes";
// import { Request, Response, NextFunction } from "express";

// interface CustomError extends Error {
//   statusCode?: number;
//   name: string;
// }
// const errorHandlerMiddleWare = (
//   err: CustomError,
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   if ((process.env.NODE_ENV as string) === "development") {
//     console.error(err);
//   }
//   const statusCode: number =
//     err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
//   const msg: string = err.message || "Something went wrong try again later";
//   res.status(statusCode).json({ msg });
// };

// export default errorHandlerMiddleWare;
