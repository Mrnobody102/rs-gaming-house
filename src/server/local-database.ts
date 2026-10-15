import { PGlite } from "@electric-sql/pglite";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { seedWorkshop } from "./workshop-seed";

export const DEMO_ADMIN = "02be7e37-9acb-42d2-a290-19211cd8c77a";
export async function initializeDatabase(db: PGlite) {
  await db.exec(`create schema if not exists auth;
    do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; end $$;
    create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table if not exists public.local_migrations(name text primary key);`);
  for (const version of [
    "202610150001_game",
    "202610150004_earth_games",
    "202610150005_difficulty",
    "202610150006_direct_answers",
    "202610150007_simple_authoring",
    "202610150008_session_competition",
    "202610150009_tiebreak_validation",
    "202610150010_authoring_guards",
    "202610150011_preserve_room_snapshots",
    "202610150012_quiz_buzz",
    "202610150013_repair_buzz_windows",
    "202610160014_workshop_rules",
  ]) {
    const applied = await db.query(
      "select name from public.local_migrations where name=$1",
      [version],
    );
    if (!applied.rows.length) {
      const sql = await readFile(
        path.join(process.cwd(), "supabase/migrations", `${version}.sql`),
        "utf8",
      );
      await db.transaction(async (tx) => {
        await tx.exec(sql);
        await tx.query("insert into public.local_migrations values($1)", [
          version,
        ]);
      });
    }
  }
  await db.query(
    "insert into public.app_admins values($1) on conflict do nothing",
    [DEMO_ADMIN],
  );
}
const globalDatabase = globalThis as typeof globalThis & {
  earthplayDb?: Promise<PGlite>;
  earthplayVersion?: string;
};
export function localDatabase() {
  if (
    globalDatabase.earthplayDb &&
    globalDatabase.earthplayVersion !== "014-workshop-final"
  )
    globalDatabase.earthplayDb = globalDatabase.earthplayDb.then(async (db) => {
      await initializeDatabase(db);
      await seedWorkshop(db, DEMO_ADMIN);
      return db;
    });
  globalDatabase.earthplayVersion = "014-workshop-final";
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
