import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { initializeDatabase, DEMO_ADMIN } from "../src/server/local-database";
import { samples } from "../src/features/questions/samples";
import type { GameView } from "../src/features/sessions/model";
import { questionSchema } from "../src/features/questions/model";
import { shuffledTiles } from "../src/features/play/puzzle";
import { readFile } from "node:fs/promises";

let db: PGlite;
async function rpc<T = unknown>(
  name: string,
  args: unknown[] = [],
  admin: boolean | string = false,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      typeof admin === "string" ? admin : admin ? DEMO_ADMIN : "",
    ]);
    const { rows } = await tx.query<{ value: T }>(
      `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as value`,
      args.map((x) =>
        x && typeof x === "object" && !Array.isArray(x) ? JSON.stringify(x) : x,
      ),
    );
    return rows[0].value;
  });
}
async function room(capacity = 60) {
  return rpc<{ id: string; code: string; view_token: string }>(
    "session_create",
    ["Test room", samples.map((q) => q.id), capacity],
    true,
  );
}
async function view(id: string, token = "", host = false) {
  return rpc<GameView>("session_view", [id, token], host);
}
async function act(id: string, action: string, roundId: string) {
  return rpc<GameView>("session_control", [id, action, roundId], true);
}
beforeAll(async () => {
  db = new PGlite();
  await initializeDatabase(db);
  for (const q of samples) await rpc("bank_save", [q], true);
}, 30000);
afterAll(async () => {
  await db.close();
});
describe("shared PostgreSQL game rules", () => {
  it("reuses ordered question sets without sharing a mutable session", async () => {
    const setId = crypto.randomUUID(),
      ids = [samples[1].id, samples[0].id];
    await rpc("set_save", [setId, "Reusable set", ids], true);
    const sets = await rpc<{ id: string; questionIds: string[] }[]>(
      "set_list",
      [],
      true,
    );
    expect(sets.find((s) => s.id === setId)?.questionIds).toEqual(ids);
    const s = await rpc<{ id: string }>(
      "session_create",
      ["From a set", ids, 30],
      true,
    );
    expect((await view(s.id, "", true)).question.kind).toBe("puzzle");
    await rpc("set_archive", [setId], true);
    expect((await view(s.id, "", true)).total).toBe(2);
  });
  it("isolates one admin's questions and sessions from another admin", async () => {
    const other = crypto.randomUUID();
    await db.query("insert into public.app_admins values($1)", [other]);
    const s = await room();
    await expect(rpc("bank_save", [samples[0]], other)).rejects.toThrow(
      "quyền sửa",
    );
    await expect(
      rpc(
        "session_create",
        ["Wrong owner", samples.map((q) => q.id), 30],
        other,
      ),
    ).rejects.toThrow("ngân hàng");
    await expect(
      rpc(
        "session_control",
        [s.id, "start", (await view(s.id, "", true)).roundId],
        other,
      ),
    ).rejects.toThrow("quyền điều khiển");
  });
  it("validates both formats and creates readable non-geographic samples", () => {
    for (const q of samples)
      expect(questionSchema.safeParse(q).success).toBe(true);
    expect(
      questionSchema.safeParse({ ...samples[0], correct: 5 }).success,
    ).toBe(false);
    for (const grid of [2, 3]) {
      const tiles = shuffledTiles("round", grid);
      expect(new Set(tiles).size).toBe(grid * grid);
      expect(tiles.some((t, i) => t !== i)).toBe(true);
    }
  });
  it("denies admin functions and direct table reads to a guest", async () => {
    await expect(rpc("bank_list")).rejects.toThrow("quản trị");
    await expect(
      db.transaction(async (tx) => {
        await tx.exec("set local role anon");
        await tx.query("select * from public.questions");
      }),
    ).rejects.toThrow(/permission/i);
  });
  it("keeps session snapshots independent of edits and blocks missing or null access tokens", async () => {
    const s = await room();
    const original = await view(s.id, "", true);
    await expect(view(s.id)).rejects.toThrow("Vào phòng");
    await expect(rpc("session_view", [s.id, null])).rejects.toThrow(
      "Vào phòng",
    );
    await rpc(
      "bank_save",
      [{ ...samples[0], title: "Edited only in the bank" }],
      true,
    );
    expect((await view(s.id, s.view_token)).question.title).toBe(
      original.question.title,
    );
    await rpc("bank_save", [samples[0]], true);
  });
  it("never reveals correctness or points before the host publishes results", async () => {
    const s = await room(),
      token = crypto.randomUUID() + crypto.randomUUID();
    await rpc("session_join", [s.code, "Player", token]);
    let g = await view(s.id, token);
    expect(g.question).not.toHaveProperty("correct");
    g = await act(s.id, "start", g.roundId);
    await rpc("answer_submit", [s.id, g.roundId, token, { choice: 0 }]);
    g = await view(s.id, token);
    expect(g.myAnswer).not.toHaveProperty("correct");
    expect(g.standings[0].score).toBe(0);
    g = await act(s.id, "reveal", g.roundId);
    expect(g.standings[0].score).toBe(200);
    expect((await view(s.id, token)).myAnswer?.correct).toBe(true);
    await act(s.id, "reveal", g.roundId);
    expect((await view(s.id, token)).standings[0].score).toBe(200);
  });
  it("submits once, refuses late answers and rejects stale round IDs", async () => {
    const s = await room(),
      token = crypto.randomUUID();
    await rpc("session_join", [s.code, "Once", token]);
    let g = await view(s.id, "", true);
    g = await act(s.id, "start", g.roundId);
    await rpc("answer_submit", [s.id, g.roundId, token, { choice: 0 }]);
    await rpc("answer_submit", [s.id, g.roundId, token, { choice: 1 }]);
    expect((await view(s.id, token)).myAnswer?.payload).toEqual({ choice: 0 });
    const late = crypto.randomUUID();
    await expect(
      rpc("answer_submit", [s.id, null, token, { choice: 0 }]),
    ).rejects.toThrow("câu khác");
    await expect(
      rpc("session_control", [s.id, "reveal", null], true),
    ).rejects.toThrow("thay đổi");
    await rpc("session_join", [s.code, "Late", late]);
    await db.query(
      "update public.game_sessions set deadline=now()-interval '1 second' where id=$1",
      [s.id],
    );
    await expect(
      rpc("answer_submit", [s.id, g.roundId, late, { choice: 0 }]),
    ).rejects.toThrow("hết thời gian");
    await act(s.id, "reveal", g.roundId);
    await act(s.id, "next", g.roundId);
    await expect(
      rpc("answer_submit", [s.id, g.roundId, token, { choice: 0 }]),
    ).rejects.toThrow("câu khác");
  });
  it("grades puzzle permutations on the server and rejects duplicate pieces", async () => {
    const s = await room(),
      token = crypto.randomUUID();
    await rpc("session_join", [s.code, "Puzzle", token]);
    let g = await view(s.id, "", true);
    g = await act(s.id, "start", g.roundId);
    g = await act(s.id, "reveal", g.roundId);
    g = await act(s.id, "next", g.roundId);
    await expect(
      rpc("answer_submit", [s.id, g.roundId, token, { tiles: [0, 0, 2, 3] }]),
    ).rejects.toThrow("trùng");
    await rpc("answer_submit", [
      s.id,
      g.roundId,
      token,
      { tiles: [0, 1, 2, 3] },
    ]);
    await act(s.id, "reveal", g.roundId);
    expect((await view(s.id, token)).myAnswer?.points).toBe(200);
  });
  it("accepts 60 joins and answers without exceeding capacity or counting retries twice", async () => {
    const s = await room(),
      tokens = Array.from({ length: 60 }, () => crypto.randomUUID());
    const started = performance.now();
    await Promise.all(
      tokens.map((token, i) =>
        rpc("session_join", [s.code, `P${i + 1}`, token]),
      ),
    );
    await expect(
      rpc("session_join", [s.code, "Overflow", crypto.randomUUID()]),
    ).rejects.toThrow("đủ người");
    await rpc("session_join", [s.code, "P1", tokens[0]]);
    let g = await view(s.id, "", true);
    expect(g.count).toBe(60);
    g = await act(s.id, "start", g.roundId);
    await Promise.all(
      tokens.map((token, i) =>
        rpc("answer_submit", [s.id, g.roundId, token, { choice: i % 2 }]),
      ),
    );
    await Promise.all(
      tokens
        .slice(0, 10)
        .map((token) =>
          rpc("answer_submit", [s.id, g.roundId, token, { choice: 3 }]),
        ),
    );
    g = await act(s.id, "reveal", g.roundId);
    expect(g.answered).toBe(60);
    expect(g.standings.filter((p) => p.score === 200)).toHaveLength(30);
    expect(g.standings.reduce((n, p) => n + p.score, 0)).toBe(6000);
    console.log(
      `60 local PostgreSQL participants: joins + answers + retries + scoring in ${Math.round(performance.now() - started)} ms`,
    );
  }, 30000);
  it("compiles the Supabase service migration, enforces upload RLS and emits only a revision signal", async () => {
    await db.exec(`create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant all on storage.objects to authenticated;
      create schema realtime;create table realtime.test_messages(payload jsonb,event text,topic text,private boolean);
      create function realtime.send(payload jsonb,event text,topic text,private boolean) returns void language sql as $$ insert into realtime.test_messages values(payload,event,topic,private) $$;`);
    await db.exec(
      await readFile(
        "supabase/migrations/202610150002_storage_realtime.sql",
        "utf8",
      ),
    );
    await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        DEMO_ADMIN,
      ]);
      await tx.exec("set local role authenticated");
      await tx.query(
        "insert into storage.objects(bucket_id,name) values('question-media','authorized.png')",
      );
    });
    await expect(
      db.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
          crypto.randomUUID(),
        ]);
        await tx.exec("set local role authenticated");
        await tx.query(
          "insert into storage.objects(bucket_id,name) values('question-media','unauthorized.png')",
        );
      }),
    ).rejects.toThrow(/row.level.security/i);
    const s = await room();
    const g = await view(s.id, "", true);
    await act(s.id, "start", g.roundId);
    const { rows } = await db.query<{ payload: object }>(
      "select payload from realtime.test_messages",
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(Object.keys(rows[0].payload)).toEqual(["revision"]);
  });
});
