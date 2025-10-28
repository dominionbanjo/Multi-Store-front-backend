import postgres from "postgres";
import dotenv from "dotenv";
dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL missing from environment variables");
  process.exit(1);
}

let sql: postgres.Sql;

try {
  sql = postgres(connectionString, {
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10,
    max: 10,
    idle_timeout: 30,
  });

  // Test connection once at startup
  await sql`SELECT NOW()`;
  console.log("✅ Connected to PostgreSQL database successfully");
} catch (err) {
  console.error("❌ Failed to connect to PostgreSQL:", err);
  process.exit(1);
}

export default sql;
