import { PGlite } from "@electric-sql/pglite";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { seedWorkshop } from "./workshop-seed";
import { initializeDatabase, DEMO_ADMIN } from "./database-schema";
export { initializeDatabase, DEMO_ADMIN } from "./database-schema";

const globalDatabase = globalThis as typeof globalThis & {
  earthplayDb?: Promise<PGlite>;
  earthplayVersion?: string;
};
export function localDatabase() {
  if (
    globalDatabase.earthplayDb &&
    globalDatabase.earthplayVersion !== "017-workshop-hints-v4"
  )
    globalDatabase.earthplayDb = globalDatabase.earthplayDb.then(async (db) => {
      await initializeDatabase(db);
      await seedWorkshop(db, DEMO_ADMIN);
      return db;
    });
  globalDatabase.earthplayVersion = "017-workshop-hints-v4";
  return (globalDatabase.earthplayDb ??= (async () => {
    const dir = path.resolve(
      process.env.APP_DATA_DIR ||
        process.env.DEMO_DATA_DIR ||
        ".local/postgres",
    );
    await mkdir(dir, { recursive: true });
    const db = new PGlite(dir);
    await initializeDatabase(db);
    await seedWorkshop(db, DEMO_ADMIN);
    return db;
  })());
}
