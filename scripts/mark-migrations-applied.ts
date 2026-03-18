/**
 * Resets the Drizzle migration tracking table to match the current journal.
 * Use after squashing migrations: clears old entries and marks all current
 * journal entries as applied (since the DB already has the tables).
 *
 * Run with: npx tsx scripts/mark-migrations-applied.ts
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { join } from "path";
import * as dotenv from "dotenv";

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  const journal = JSON.parse(
    readFileSync(
      join(process.cwd(), "drizzle/migrations/meta/_journal.json"),
      "utf-8"
    )
  );

  // Clear old migration tracking entries (from pre-squash migrations)
  const oldRows = await sql`SELECT hash FROM drizzle."__drizzle_migrations"` as Array<Record<string, unknown>>;
  if (oldRows.length > 0) {
    const hashes = oldRows.map((r) => String(r.hash));
    console.log(`Clearing ${oldRows.length} old migration entries: ${hashes.join(", ")}`);
    await sql`DELETE FROM drizzle."__drizzle_migrations"`;
  }

  // Mark all current journal entries as applied (DB already has the schema)
  for (const entry of journal.entries) {
    console.log(`Marking as applied: ${entry.tag}`);
    await sql`
      INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
      VALUES (${entry.tag}, ${entry.when})
    `;
  }

  console.log("Done. Migration tracking is now in sync with the journal.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
