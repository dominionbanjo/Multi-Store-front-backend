import "express-async-errors";
import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
import helmet from "helmet";
import { configureHelmet } from "./utils/security/helmetConfig.js";
import { configureCors } from "./utils/security/corsConfig.js";
import { configureRateLimit } from "./utils/security/rateLimitConfig.js";
import morgan from "morgan";
import { sanitizeInput } from "./middlewares/sanitizeInputs.js";
import cloudinary from "cloudinary";

// Routers
import authRouter from "./routes/authRoutes.js";
import cartRouter from "./routes/cartRoutes.js";
import orderRouter from "./routes/orderRoutes.js";
import productRouter from "./routes/productRoutes.js";
import reviewRouter from "./routes/reviewRoutes.js";
import storeRouter from "./routes/storeRoutes.js";
import userRouter from "./routes/userRoutes.js";
import wishlistRouter from "./routes/wishlistRoutes.js";

// Middlewares
import errorHandlerMiddleWare from "./middlewares/errorHandlerMiddleWare.js";

// ✅ Import DB sync utility
import { syncAllModels } from "./utils/db/sync.js";

// CLOUDINARY CONFIG
cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME as string,
  api_key: process.env.CLOUD_API_KEY as string,
  api_secret: process.env.CLOUD_API_SECRET as string,
});

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

//SECURITY MIDDLEWARE
app.use(helmet());
app.use(configureHelmet());
app.use(sanitizeInput);
app.use(configureCors());
app.use(configureRateLimit());

// Middleware
app.use(express.json());
app.use(morgan("dev"));

// Routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/cart", cartRouter);
app.use("/api/v1/order", orderRouter);
app.use("/api/v1/product", productRouter);
app.use("/api/v1/review", reviewRouter);
app.use("/api/v1/store", storeRouter);
app.use("/api/v1/wishlist", wishlistRouter);

// ✅ Test route
app.get("/test", async (_req, res) => {
  res.json({ message: "Server running" });
});

// Global error handler
app.use(errorHandlerMiddleWare);

// ───────────────────────────────────────────────
// 🚀 SERVER START WITH DB SYNC
// ───────────────────────────────────────────────
const port = process.env.PORT || 5300;

const startServer = async () => {
  try {
    // ✅ Sync all database models before starting server
    console.log("🔄 Syncing database models...");
    await syncAllModels();
    console.log("✅ All models synced successfully");

    // ✅ Start the server
    app.listen(port, () => {
      const url = `http://localhost:${port}`;
      console.log(`🚀 Server listening on port ${port}`);
      console.log(`👉 Press Ctrl + Click to open: ${url}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// ✅ Initialize server
startServer();
