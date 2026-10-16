import type { SqlDatabase } from "./database-types";
export { DEMO_ADMIN } from "./database-schema";

const state = globalThis as typeof globalThis & {
  earthplayPostgres?: Promise<SqlDatabase>;
};

export async function applicationDatabase(): Promise<SqlDatabase> {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    return (state.earthplayPostgres ??= import("./postgres-database")
      .then(({ openPostgresDatabase }) => openPostgresDatabase(url))
      .catch((error) => {
        state.earthplayPostgres = undefined;
        throw error;
      }));
  }
  // Loading PostgreSQL must never initialize/import the embedded WASM database.
  const { localDatabase } = await import("./local-database");
  return localDatabase();
}
