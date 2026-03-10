import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "./schema";

// Pool (WebSocket-based) requires ws in Node.js — only used for transactions
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("database url not found");
}

// HTTP-based driver for all regular queries — no WebSocket, no cold-start timeouts
const sql = neon(process.env.DATABASE_URL);
export const db = drizzleHttp(sql, { schema });

// Pool kept for raw transactions only (pool.connect() → BEGIN/COMMIT pattern)
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});
