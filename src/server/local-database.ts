import { PGlite } from "@electric-sql/pglite";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { starterQuestions as samples } from "@/content/starter";

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
  if (globalDatabase.earthplayDb && globalDatabase.earthplayVersion !== "011")
    globalDatabase.earthplayDb = globalDatabase.earthplayDb.then(async (db) => {
      await initializeDatabase(db);
      for (const q of samples.filter((q) => q.kind === "riddle"))
        await db.query(
          "insert into public.questions(id,owner_id,body) values($1,$2,$3) on conflict do nothing",
          [q.id, DEMO_ADMIN, JSON.stringify(q)],
        );
      return db;
    });
  globalDatabase.earthplayVersion = "011";
  return (globalDatabase.earthplayDb ??= (async () => {
    const dir = path.resolve(
      process.env.APP_DATA_DIR ||
        process.env.DEMO_DATA_DIR ||
        ".local/postgres",
    );
    await mkdir(dir, { recursive: true });
    const db = new PGlite(dir);
    await initializeDatabase(db);
    const count = await db.query<{ count: number }>(
      "select count(*)::integer as count from public.questions",
    );
    if (!count.rows[0].count)
      for (const q of samples)
        await db.query(
          "insert into public.questions(id,owner_id,body) values($1,$2,$3)",
          [q.id, DEMO_ADMIN, JSON.stringify(q)],
        );
    // Upgrade an untouched sample bank without replacing any authored content.
    const custom = await db.query(
      "select id from public.questions where not (id=any($1::uuid[])) limit 1",
      [samples.map((q) => q.id)],
    );
    if (!custom.rows.length)
      for (const q of samples)
        await db.query(
          "insert into public.questions(id,owner_id,body) values($1,$2,$3) on conflict do nothing",
          [q.id, DEMO_ADMIN, JSON.stringify(q)],
        );
    for (const q of samples.filter((q) => q.kind === "riddle"))
      await db.query(
        "insert into public.questions(id,owner_id,body) values($1,$2,$3) on conflict do nothing",
        [q.id, DEMO_ADMIN, JSON.stringify(q)],
      );
    return db;
  })());
}
