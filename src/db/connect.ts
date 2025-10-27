import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL as string;

if (!connectionString) {
  throw new Error("❌ DATABASE_URL not found in environment variables");
}

const sql = postgres(connectionString, {
  ssl: { rejectUnauthorized: false }, // Required for Supabase
});

export default sql;
