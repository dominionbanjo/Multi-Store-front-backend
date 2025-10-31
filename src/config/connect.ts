import postgres from "postgres";
import dotenv from "dotenv";
import { syncModels } from "./db/modelRegistry.js";
dotenv.config();

const connectionString = process.env.DATABASE_URL!;

if (!connectionString) {
  console.error("❌ DATABASE_URL missing from environment variables");
  process.exit(1);
}

/**
 * Attempts to connect to PostgreSQL with retry support and model sync.
 */
async function connectWithRetry(
  retries = 5,
  delay = 2000 // ms
): Promise<postgres.Sql> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(
        `🔄 Connecting to PostgreSQL... (Attempt ${attempt}/${retries})`
      );

      const sql = postgres(connectionString, {
        ssl: { rejectUnauthorized: false },
        connect_timeout: 10,
        max: 10,
        idle_timeout: 30,
      });

      // Simple test query
      await sql`SELECT NOW()`;

      console.log("✅ Connected to PostgreSQL successfully");

      // ✅ Run syncModels once connection succeeds
      await syncModels();
      console.log("🧩 Models synced successfully after connection");

      return sql;
    } catch (err) {
      console.error(
        `⚠️ Connection attempt ${attempt} failed:`,
        (err as Error).message
      );

      if (attempt < retries) {
        const backoff = delay * attempt;
        console.log(`⏳ Retrying in ${backoff / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      } else {
        console.error(
          "❌ All connection attempts failed. Will retry indefinitely..."
        );
      }
    }
  }

  // Continuous retry fallback
  console.log("🔁 Entering continuous retry mode...");
  while (true) {
    try {
      const sql = postgres(connectionString, {
        ssl: { rejectUnauthorized: false },
        connect_timeout: 10,
        max: 10,
        idle_timeout: 30,
      });

      await sql`SELECT NOW()`;
      console.log("✅ Reconnected to PostgreSQL successfully");

      // ✅ Run syncModels after successful reconnection
      await syncModels();
      console.log("🧩 Models re-synced successfully");

      return sql;
    } catch (err) {
      console.error("⚠️ Retry failed, trying again in 10s...");
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}

const sql = await connectWithRetry();
export default sql;
