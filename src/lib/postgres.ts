import { Pool } from "pg";
import { config } from "../config";

const pool = new Pool({
  connectionString: config.postgres.connectionString,
  max: config.postgres.maxPool,
});

pool.on("error", (error) => {
  console.error("PostgreSQL pool error:", error);
});

export async function connectPostgres() {
  const client = await pool.connect();
  client.release();
  console.log("PostgreSQL connected");
  return pool;
}

export async function closePostgres() {
  await pool.end();
  console.log("PostgreSQL disconnected");
}

export { pool };