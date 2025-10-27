import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
import sql from "./db/connect.js";
import helmet from "helmet";
import { configureHelmet } from "./utils/security/helmetConfig.js";
import { configureCors } from "./utils/security/corsConfig.js";
import { configureRateLimit } from "./utils/security/rateLimitConfig.js";
import requestLogger from "./middlewares/requestsLogger.js";
import { sanitizeInput } from "./middlewares/sanitizeInputs.js";

// Routers
import userRouter from "./routes/userRoutes.js";
import authRouter from "./routes/authRoutes.js";

// Middlewares
import errorHandlerMiddleWare from "./middlewares/errorHandlerMiddleWare.js";

const app = express();
app.disable("x-powered-by");

//SECURITY MIDDLEWARE
app.use(helmet());
app.use(configureHelmet());
app.use(sanitizeInput);
app.use(configureCors());
app.use(configureRateLimit());

// Middleware
app.use(express.json());
// app.use(morgan("dev"));
app.use(requestLogger);

// Routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);

// ✅ Test route
app.get("/", async (_req, res) => {
  try {
    const result = await sql`SELECT NOW()`;
    res.json({ message: "Server running", dbTime: result[0].now });
  } catch (error) {
    console.error("❌ Database error:", error);
    res.status(500).json({ error: "Database connection error" });
  }
});

// Global error handler
app.use(errorHandlerMiddleWare);

// Server start
const port = process.env.PORT || 5300;
app.listen(port, () => {
  const url = `http://localhost:${port}`;
  console.log(`🚀 Server listening on port ${port}`);
  console.log(`👉 Press Ctrl + Click to open: ${url}`);
});
