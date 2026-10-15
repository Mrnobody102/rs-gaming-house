import { afterAll, beforeAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { initializeDatabase, DEMO_ADMIN } from "../src/server/local-database";
import { workshopQuestions } from "../src/content/workshop";
import type { GameView } from "../src/features/sessions/model";
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
  admin = true,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      admin ? DEMO_ADMIN : "",
    ]);
    return (
      await tx.query<{ v: T }>(
        `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as v`,
        args,
      )
    ).rows[0].v;
  });
}
async function room() {
  const questions = [1, 2].map((_, i) => ({
    ...workshopQuestions[1],
    id: crypto.randomUUID(),
    difficulty: i ? "hard" : "medium",
    points: i ? 400 : 300,
  }));
  for (const q of questions) await rpc("bank_save", [JSON.stringify(q)]);
  const s = await rpc<{ id: string; code: string }>("session_create", [
    "Flow test",
    [questions[0].id],
    60,
    [questions[0].id],
    null,
    [questions[1].id],
    50,
  ]);
  const tokens = [crypto.randomUUID(), crypto.randomUUID()];
  for (const [i, token] of tokens.entries())
    await rpc("session_join", [s.code, ["A", "B"][i], token], false);
  let g = await rpc("session_view", [s.id]);
  g = await rpc("session_control", [s.id, "start", g.roundId]);
  return { ...s, tokens, g };
}
it("guards ungraded answers, publishes a wrong verdict immediately and scores the next winner exactly once", async () => {
  const { id, tokens, g: first } = await room();
  let g = await rpc("session_hint", [id, first.roundId]);
  expect(g.question.points).toBe(250);
  await rpc("star_select", [id, g.roundId, tokens[0], true], false);
  g = await rpc("buzz_control", [id, g.roundId, true]);
  const oldWindow = g.buzzId;
  g = await rpc("buzz_submit", [id, g.roundId, tokens[0], g.buzzId], false);
  const a = g.myId;
  for (const action of ["reveal", "finish"])
    await expect(
      rpc("session_control", [id, action, g.roundId]),
    ).rejects.toThrow("Chấm đúng hoặc sai");
  await rpc("buzz_grade", [id, g.roundId, a, false]);
  g = await rpc("session_view", [id, tokens[0]], false);
  expect(g.phase).toBe("question");
  expect(g.myAnswer).toMatchObject({ correct: false, points: 0 });
  expect(g.star.used).toBe(true);
  expect(g.buzzRemaining).toBe(1);
  await rpc("star_select", [id, g.roundId, tokens[1], true], false);
  g = await rpc("buzz_control", [id, g.roundId, true]);
  expect(g.buzzId).not.toBe(oldWindow);
  await expect(
    rpc("buzz_submit", [id, g.roundId, tokens[0], g.buzzId], false),
  ).rejects.toThrow("đã trả lời");
  await expect(
    rpc("buzz_submit", [id, g.roundId, tokens[1], oldWindow], false),
  ).rejects.toThrow("thay đổi");
  g = await rpc("buzz_submit", [id, g.roundId, tokens[1], g.buzzId], false);
  const b = g.myId;
  await rpc("buzz_grade", [id, g.roundId, a, false]);
  expect((await rpc("session_view", [id])).buzzWinner?.id).toBe(b);
  g = await rpc("buzz_grade", [id, g.roundId, b, true]);
  expect(g.phase).toBe("result");
  expect(g.standings.find((p) => p.id === b)?.score).toBe(500);
  expect(g.standings.find((p) => p.id === a)?.score).toBe(0);
  await rpc("buzz_grade", [id, g.roundId, b, true]);
  await rpc("session_control", [id, "reveal", g.roundId]);
  expect(
    (await rpc("session_view", [id])).standings.find((p) => p.id === b)?.score,
  ).toBe(500);
});
it("ends an exhausted bell cleanly and uses a zero-point reserve to resolve tied prizes", async () => {
  const { id, tokens, g: first } = await room();
  let g = first;
  for (const token of tokens) {
    g = await rpc("buzz_control", [id, g.roundId, true]);
    g = await rpc("buzz_submit", [id, g.roundId, token, g.buzzId], false);
    g = await rpc("buzz_grade", [id, g.roundId, g.myId, false]);
  }
  expect(g.buzzRemaining).toBe(0);
  await expect(rpc("buzz_control", [id, g.roundId, true])).rejects.toThrow(
    "Mọi người đã trả lời",
  );
  g = await rpc("session_control", [id, "reveal", g.roundId]);
  g = await rpc("session_control", [id, "next", g.roundId]);
  expect(g.tiebreak.pending).toBe(true);
  g = await rpc("tie_start", [id, g.roundId]);
  expect(g.question.points).toBe(0);
  expect(g.question.hopeStar).toBe(false);
  await rpc("session_hint", [id, g.roundId]);
  g = await rpc("buzz_control", [id, g.roundId, true]);
  g = await rpc("buzz_submit", [id, g.roundId, tokens[1], g.buzzId], false);
  const winner = g.myId;
  g = await rpc("buzz_grade", [id, g.roundId, winner, true]);
  expect(g.standings.find((p) => p.id === winner)).toMatchObject({
    rank: 1,
    score: 0,
  });
  expect(g.tiebreak.pending).toBe(false);
});
it("keeps phone quiz correctness private and requires scoring before finish", async () => {
  const q = {
    ...workshopQuestions[1],
    id: crypto.randomUUID(),
    kind: "choice",
    difficulty: "hard",
    points: 400,
    options: ["Yes", "No"],
    correct: 0,
    interaction: "submit",
  };
  await rpc("bank_save", [JSON.stringify(q)]);
  const s = await rpc<{ id: string; code: string }>("session_create", [
    "Phone quiz",
    [q.id],
    60,
    [q.id],
    null,
    [],
    50,
  ]);
  const token = crypto.randomUUID();
  await rpc("session_join", [s.code, "Quiz", token], false);
  let g = await rpc("session_view", [s.id]);
  g = await rpc("session_control", [s.id, "start", g.roundId]);
  await rpc("star_select", [s.id, g.roundId, token, true], false);
  await rpc(
    "answer_submit",
    [s.id, g.roundId, token, JSON.stringify({ choice: 0 })],
    false,
  );
  expect(
    (await rpc("session_view", [s.id, token], false)).myAnswer,
  ).not.toHaveProperty("correct");
  for (let i = 0; i < 2; i++) await rpc("session_hint", [s.id, g.roundId]);
  await expect(
    rpc("session_control", [s.id, "finish", g.roundId]),
  ).rejects.toThrow("tính điểm");
  g = await rpc("session_control", [s.id, "reveal", g.roundId]);
  expect(g.standings[0].score).toBe(600);
  g = await rpc("session_control", [s.id, "finish", g.roundId]);
  expect(g.standings[0].score).toBe(600);
});
