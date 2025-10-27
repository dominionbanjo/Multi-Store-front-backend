import morgan from "morgan";
import logger from "../utils/logs/logger.js";
import { Request } from "express";

// Define a custom token for user details (if authenticated)
morgan.token("user", (req: Request) => {
  const user = (req as any).user;
  if (!user) return "guest";
  return `${user.name} (${user.userId}, role=${user.role})`;
});

// Define a Morgan → Winston stream
const stream = {
  write: (message: string) => logger.http(message.trim()),
};

// Define the log format
const format =
  ":method :url :status :res[content-length] - :response-time ms :user";

// Create the actual middleware
const requestLogger = morgan(format, {
  stream,
  skip: () => process.env.NODE_ENV === "test", // skip logs in tests
});

export default requestLogger;
