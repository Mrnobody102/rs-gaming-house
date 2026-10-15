import { afterAll, beforeAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { initializeDatabase, DEMO_ADMIN } from "../src/server/local-database";
import { workshopQuestions } from "../src/content/workshop";
import type { GameView, SessionPlan } from "../src/features/sessions/model";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await initializeDatabase(db);
}, 30000);
afterAll(async () => {
  await db.close();
});
async function rpc<T = GameView>(
  name: string,
  args: unknown[] = [],
  user: string = DEMO_ADMIN,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user,
    ]);
    return (
      await tx.query<{ v: T }>(
        `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as v`,
        args,
      )
    ).rows[0].v;
  });
}
async function content() {
  const questions = workshopQuestions
    .slice(1, 4)
    .map((q) => ({ ...q, id: crypto.randomUUID() }));
  for (const q of questions) await rpc("bank_save", [JSON.stringify(q)]);
  const [a, b, reserve] = questions.map((q) => q.id),
    set = crypto.randomUUID();
  await rpc("set_save", [set, "Shared content", [a, b], [a], [reserve]]);
  const create = () =>
    rpc<{ id: string; code: string }>("session_create", [
      "Scoped room",
      [a, b],
      60,
      [a],
      set,
      [reserve],
    ]);
  return { a, b, reserve, set, first: await create(), second: await create() };
}
it("removes a question only from the edited set or lobby and locks editing after start", async () => {
  const c = await content();
  await rpc("set_save", [c.set, "Shared content", [c.b], [], [c.reserve]]);
  expect((await rpc("session_view", [c.first.id])).total).toBe(2);
  await rpc("session_plan_save", [
    c.first.id,
    "Changed lobby",
    [c.a],
    60,
    [],
    [],
  ]);
  const plan = await rpc<SessionPlan>("session_plan", [c.first.id]);
  expect(plan.questionIds).toEqual([c.a]);
  expect(plan.starQuestionIds).toEqual([]);
  expect(plan.reserveQuestionIds).toEqual([]);
  expect((await rpc("session_view", [c.second.id])).total).toBe(2);
  expect(
    (await rpc<{ id: string }[]>("bank_list")).some((q) => q.id === c.b),
  ).toBe(true);
  const sets = await rpc<{ id: string; questionIds: string[] }[]>("set_list");
  expect(sets.find((s) => s.id === c.set)?.questionIds).toEqual([c.b]);
  const g = await rpc("session_view", [c.first.id]);
  await rpc("session_control", [c.first.id, "start", g.roundId]);
  await expect(
    rpc("session_plan_save", [c.first.id, "Too late", [c.b], 60, [], []]),
  ).rejects.toThrow("trước khi bắt đầu");
});
it("cleans bank deletions out of all set lists and keeps snapshots and empty drafts usable", async () => {
  const c = await content(),
    empty = crypto.randomUUID();
  await rpc("set_save", [empty, "Will become empty", [c.a], [c.a], []]);
  await rpc("bank_archive", [c.a]);
  await rpc("bank_archive", [c.reserve]);
  const sets =
    await rpc<
      {
        id: string;
        questionIds: string[];
        starQuestionIds: string[];
        reserveQuestionIds: string[];
      }[]
    >("set_list");
  expect(sets.find((s) => s.id === c.set)).toMatchObject({
    questionIds: [c.b],
    starQuestionIds: [],
    reserveQuestionIds: [],
  });
  expect(sets.find((s) => s.id === empty)?.questionIds).toEqual([]);
  const plan = await rpc<SessionPlan>("session_plan", [c.first.id]);
  expect(plan.questionIds).toEqual([c.a, c.b]);
  expect(plan.reserveQuestionIds).toEqual([c.reserve]);
  await rpc("session_plan_save", [
    c.first.id,
    "Still playable",
    plan.questionIds,
    60,
    plan.starQuestionIds,
    plan.reserveQuestionIds,
  ]);
  await rpc("set_archive", [c.set]);
  expect((await rpc("session_view", [c.first.id])).total).toBe(2);
  expect(
    (await rpc<{ id: string }[]>("bank_list")).some((q) => q.id === c.b),
  ).toBe(true);
});
it("deletes an active room and all player data without deleting its bank, set or other room", async () => {
  const c = await content(),
    token = crypto.randomUUID(),
    other = crypto.randomUUID();
  await db.query("insert into public.app_admins values($1)", [other]);
  await expect(rpc("session_delete", [c.first.id], "")).rejects.toThrow(
    "quản trị",
  );
  await expect(rpc("session_delete", [c.first.id], other)).rejects.toThrow(
    "quyền xóa",
  );
  const joined = await rpc<{ id: string; participantId?: string }>(
    "session_join",
    [c.first.code, "Player", token],
    "",
  );
  let g = await rpc("session_view", [joined.id, token]);
  const playerId = g.myId;
  g = await rpc("session_control", [c.first.id, "start", g.roundId]);
  await rpc("star_select", [c.first.id, g.roundId, token, true], "");
  g = await rpc("buzz_control", [c.first.id, g.roundId, true]);
  await rpc("buzz_submit", [c.first.id, g.roundId, token, g.buzzId], "");
  await rpc("buzz_grade", [c.first.id, g.roundId, playerId, true]);
  await db.query("insert into public.tie_placings values($1,$2,1)", [
    c.first.id,
    playerId,
  ]);
  expect(
    (await rpc<{ deleted: boolean }>("session_delete", [c.first.id])).deleted,
  ).toBe(true);
  for (const table of [
    "session_rounds",
    "participants",
    "session_reserves",
    "tie_placings",
  ])
    expect(
      (
        await db.query(`select * from public.${table} where session_id=$1`, [
          c.first.id,
        ])
      ).rows,
    ).toHaveLength(0);
  for (const table of ["answers", "round_stars"])
    expect(
      (
        await db.query(
          `select * from public.${table} where participant_id=$1`,
          [playerId],
        )
      ).rows,
    ).toHaveLength(0);
  await expect(
    rpc("session_view", [c.first.id, token], ""),
  ).rejects.toMatchObject({ code: "P0002" });
  expect((await rpc("session_view", [c.second.id])).total).toBe(2);
  expect(
    (await rpc<{ id: string }[]>("set_list")).some((s) => s.id === c.set),
  ).toBe(true);
  expect(
    (await rpc<{ id: string }[]>("bank_list")).some((q) => q.id === c.a),
  ).toBe(true);
});
