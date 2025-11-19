import * as dotenv from "dotenv";
dotenv.config();

import Redis from "ioredis";

const redis = new Redis(process.env.VALKEY_URL!, {
  enableReadyCheck: true,
  maxRetriesPerRequest: null,
  connectTimeout: 20000,
});

redis.on("connect", () => console.log("🔌 Valkey connected"));
redis.on("error", (err) => console.error("❌ Valkey Error:", err));

export default redis;
