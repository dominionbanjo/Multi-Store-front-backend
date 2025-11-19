import * as dotenv from "dotenv";
dotenv.config();

import Redis from "ioredis";

const isDev = process.env.NODE_ENV === "development";
const url = process.env.VALKEY_URL;

let redis: Redis | null = null;

// Disable Redis in development OR when URL is missing
if (isDev || !url) {
  console.warn("⚠ Redis disabled (development mode or missing VALKEY_URL)");
} else {
  try {
    redis = new Redis(url, {
      enableReadyCheck: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      tls: url.startsWith("rediss://")
        ? { rejectUnauthorized: false }
        : undefined,
    });

    redis.on("connect", () => console.log("🔌 Valkey connected"));
    redis.on("error", (err) => {
      console.warn("⚠ Redis connection failed — cache disabled");
      console.warn(err.message);
      redis = null; // disable redis completely
    });
  } catch (err) {
    console.warn("❌ Redis initialization error — cache disabled");
    redis = null;
  }
}

export default redis;
