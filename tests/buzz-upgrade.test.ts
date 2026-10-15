import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { initializeDatabase, DEMO_ADMIN } from "../src/server/local-database";
import { newQuestion } from "../src/features/games/catalog";
import type { GameView } from "../src/features/sessions/model";

it("repairs an already-recorded early 012 migration and keeps the open room and its players", async () => {
  const db = new PGlite();
  try {
    await initializeDatabase(db);
    const sql = (
      await readFile("supabase/migrations/202610150012_quiz_buzz.sql", "utf8")
    ).replace(/\r\n/g, "\n");
    const body = (name: string) => {
      const prefix = sql.includes(`create or replace function public.${name}(`)
        ? `create or replace function public.${name}(`
        : `create function public.${name}(`;
      const start = sql.indexOf(prefix);
      return sql
        .slice(start, sql.indexOf("end $$;", start) + 7)
        .replace("create function", "create or replace function");
    };
    // Recreate the earlier schema still marked as 012 on the running local app.
    await db.exec(`
      delete from public.local_migrations where name='202610150013_repair_buzz_windows';
      alter table public.session_rounds drop column buzz_open_id;
      drop function public.buzz_submit(uuid,uuid,text,uuid);
      alter function public.buzz_submit_before_window(uuid,uuid,text) rename to buzz_submit;
    `);
    await db.exec(
      body("buzz_control").replace(
        /,\s*buzz_open_id=case[^;]+end where id=r.id;/,
        " where id=r.id;",
      ),
    );
    await db.exec(
      body("session_view").replace(
        "  v:=v||jsonb_build_object('buzzId',r.buzz_open_id);\n",
        "",
      ),
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      DEMO_ADMIN,
    ]);
    const q = {
      ...newQuestion("riddle"),
      title: "Existing room question",
      solution: "Answer",
      hints: [],
    };
    await db.query("select public.bank_save($1::jsonb)", [JSON.stringify(q)]);
    const room = (
      await db.query<{ s: { id: string; code: string } }>(
        "select public.session_create('Existing room',$1::uuid[],60) as s",
        [[q.id]],
      )
    ).rows[0].s;
    const token = crypto.randomUUID();
    await db.query("select public.session_join($1,'Existing player',$2)", [
      room.code,
      token,
    ]);
    async function view() {
      return (
        await db.query<{ g: GameView }>(
          "select public.session_view($1,$2) as g",
          [room.id, token],
        )
      ).rows[0].g;
    }
    let g = await view();
    await db.query("select public.session_control($1,'start',$2)", [
      room.id,
      g.roundId,
    ]);
    await db.query("select public.buzz_control($1,$2,true)", [
      room.id,
      g.roundId,
    ]);
    g = await view();
    expect(g.buzzOpen).toBe(true);
    expect(g).not.toHaveProperty("buzzId");
    const playerId = g.myId;
    const revision = g.revision;

    await initializeDatabase(db);
    g = await view();
    expect(g.buzzOpen).toBe(true);
    expect(g.buzzId).toMatch(/^[a-f0-9-]{36}$/);
    expect(g.revision).toBeGreaterThan(revision);
    expect(g.myId).toBe(playerId);
    expect(g.question.id).toBe(q.id);
    // Applying initialization again must preserve this opening's ID and timestamp.
    const windowId = g.buzzId;
    await initializeDatabase(db);
    expect((await view()).buzzId).toBe(windowId);
    await db.query("select public.buzz_submit($1,$2,$3,$4)", [
      room.id,
      g.roundId,
      token,
      windowId,
    ]);
    g = await view();
    expect(g.buzzWinner?.id).toBe(playerId);
    expect(g.buzzWinner?.elapsedMs).toBeGreaterThanOrEqual(0);
    await db.query("select public.buzz_grade($1,$2,$3,true)", [
      room.id,
      g.roundId,
      playerId,
    ]);
    expect((await view()).standings[0].score).toBe(300);
  } finally {
    await db.close();
  }
}, 30000);
