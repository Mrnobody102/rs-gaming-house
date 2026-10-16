import { Pool, type PoolClient } from "pg";
import type { SqlConnection, SqlDatabase } from "./database-types";
import { initializeDatabase, DEMO_ADMIN } from "./database-schema";
import { seedWorkshop } from "./workshop-seed";

function connection(client: Pool | PoolClient): SqlConnection {
  return {
    async query<T>(sql: string, params?: unknown[]) {
      const result = await client.query(sql, params);
      return { rows: result.rows as T[] };
    },
    async exec(sql: string) {
      await client.query(sql);
    },
  };
}

export interface PostgresDatabase extends SqlDatabase {
  close(): Promise<void>;
}

export async function openPostgresDatabase(
  url: string,
): Promise<PostgresDatabase> {
  const pool = new Pool({
    connectionString: url,
    max: 8,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 30000,
    statement_timeout: 15000,
  });
  pool.on("error", (error: Error & { code?: string }) => {
    // Never include connection URLs or credentials in logs.
    console.error("[postgres] Idle connection failed", error.code || "UNKNOWN");
  });
  const db: PostgresDatabase = {
    ...connection(pool),
    close: () => pool.end(),
    async transaction<T>(work: (tx: SqlConnection) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await work(connection(client));
        await client.query("COMMIT");
        return result;
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // Preserve the original command error if the connection was lost.
        }
        throw error;
      } finally {
        client.release();
      }
    },
  };
  try {
    const lock = await pool.connect();
    try {
      // Serialize migrations/seed when two deployments start together.
      await lock.query("select pg_advisory_lock(16102026, 1)");
      await initializeDatabase(db);
      await seedWorkshop(db, DEMO_ADMIN);
    } finally {
      try {
        await lock.query("select pg_advisory_unlock(16102026, 1)");
      } finally {
        lock.release();
      }
    }
    return db;
  } catch (error) {
    await pool.end();
    throw error;
  }
}
