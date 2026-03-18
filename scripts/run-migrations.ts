/**
 * Runs Drizzle migrations using WebSocket connection (not HTTP).
 *
 * drizzle-kit's built-in `migrate` command uses @neondatabase/serverless
 * in HTTP mode, which silently swallows SQL errors and reports
 * "migrations applied successfully" even when statements fail.
 *
 * This script uses the WebSocket-based pool connection instead,
 * which properly surfaces errors.
 *
 * Run with: npx tsx scripts/run-migrations.ts
 */
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as dotenv from "dotenv";
import { join } from "path";

dotenv.config();

neonConfig.webSocketConstructor = ws;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log("Running migrations via WebSocket connection...");

  await migrate(db, {
    migrationsFolder: join(process.cwd(), "drizzle/migrations"),
  });

  console.log("Migrations applied successfully.");
  await pool.end();
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
