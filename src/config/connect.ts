import postgres from "postgres";
import dotenv from "dotenv";
dotenv.config();

// ✅ Import syncAllModels here (safe because it doesn’t depend on connect.ts)

const connectionString = process.env.DATABASE_URL!;

if (!connectionString) {
  console.error("❌ DATABASE_URL missing from environment variables");
  process.exit(1);
}

/**
 * 🔁 Connect to PostgreSQL with retry logic and auto model sync
 */
async function connectWithRetry(
  retries = 5,
  delay = 2000
): Promise<postgres.Sql> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(
        `🔄 Connecting to PostgreSQL (attempt ${attempt}/${retries})...`
      );

      const sql = postgres(connectionString, {
        ssl: { rejectUnauthorized: false },
        connect_timeout: 10,
        max: 10,
        idle_timeout: 30,
      });

      // ✅ Test query
      await sql`SELECT NOW()`;
      console.log("✅ Connected to PostgreSQL successfully");

      // ✅ Sync models *after successful connection*
      // await syncAllModels();

      return sql;
    } catch (err) {
      console.error(`⚠️ Attempt ${attempt} failed:`, (err as Error).message);
      if (attempt < retries) {
        const backoff = delay * attempt;
        console.log(`⏳ Retrying in ${backoff / 1000}s...`);
        await new Promise((r) => setTimeout(r, backoff));
      } else {
        console.error(
          "❌ All connection attempts failed. Retrying indefinitely..."
        );
      }
    }
  }

  // 🔁 Infinite retry fallback
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

      // await syncAllModels();
      console.log("🧩 Models re-synced successfully");

      return sql;
    } catch {
      console.error("⚠️ Retry failed, trying again in 10s...");
      await new Promise((r) => setTimeout(r, 10000));
    }
  }
}

/**
 * 🧱 Automatically connect and sync on import
 */
const sql = await connectWithRetry();
export default sql;
