/**
 * Marks previously-applied migrations as complete in the Drizzle tracking table,
 * then applies any pending migrations.
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
  // Ensure the Drizzle migrations schema + table exist
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

  // Only mark migrations that were already applied to the DB before drizzle-kit tracking was set up.
  // Leave the latest migration (0002) untracked so db:migrate will apply it.
  const alreadyApplied = ["0000_perfect_wolfpack", "0001_keen_micromacro"];

  for (const entry of journal.entries) {
    const tag = entry.tag;
    if (!alreadyApplied.includes(tag)) {
      console.log(`Skipping (not yet applied): ${tag}`);
      continue;
    }
    const existing = await sql`
      SELECT id FROM drizzle."__drizzle_migrations" WHERE hash = ${tag}
    `;
    if (existing.length === 0) {
      console.log(`Marking migration as applied: ${tag}`);
      await sql`
        INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
        VALUES (${tag}, ${entry.when})
      `;
    } else {
      console.log(`Already tracked: ${tag}`);
    }
  }

  console.log("Done. Run pnpm db:migrate to apply pending migrations.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
