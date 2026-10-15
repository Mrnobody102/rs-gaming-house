import { afterAll, beforeAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { existsSync } from "node:fs";
import { initializeDatabase, DEMO_ADMIN } from "../src/server/local-database";
import { seedWorkshop } from "../src/server/workshop-seed";
import { workshopQuestions, workshopSet } from "../src/content/workshop";
import { starterQuestions } from "../src/content/starter";
import { questionSchema } from "../src/features/questions/model";
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
    const result = await tx.query<{ v: T }>(
      `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as v`,
      args,
    );
    return result.rows[0].v;
  });
}
it("ships all 12 question groups, their images and the author's confirmed answers", () => {
  expect(workshopQuestions).toHaveLength(12);
  for (const q of workshopQuestions) {
    expect(questionSchema.safeParse(q).success).toBe(true);
    for (const url of [
      q.image,
      q.answerImage,
      ...q.hints.flatMap((h) =>
        typeof h !== "string" && h.type === "image" ? [h.image] : [],
      ),
    ])
      if (url) expect(existsSync(`public${url}`)).toBe(true);
  }
  expect(
    workshopQuestions.find((q) => q.tags.includes("Slide 11")),
  ).toMatchObject({
    title: expect.stringContaining("2018"),
    solution: "Ô 16.",
  });
  expect(
    workshopQuestions.find((q) => q.tags.includes("Slide 13")),
  ).toMatchObject({ solution: "Ảnh A." });
});
it("replaces known samples once and preserves authored edits and existing room snapshots", async () => {
  const old = starterQuestions[0];
  await rpc("bank_save", [JSON.stringify(old)]);
  const authored = {
    ...old,
    id: crypto.randomUUID(),
    title: "My own question",
  };
  await rpc("bank_save", [JSON.stringify(authored)]);
  const s = await rpc<{ id: string }>("session_create", [
    "Old room",
    [old.id],
    60,
  ]);
  await seedWorkshop(db, DEMO_ADMIN);
  const bank = await rpc<{ id: string }[]>("bank_list");
  expect(bank.some((q) => q.id === old.id)).toBe(false);
  expect(bank.some((q) => q.id === authored.id)).toBe(true);
  expect((await rpc("session_view", [s.id])).question.id).toBe(old.id);
  const sets = await rpc<{ id: string; questionIds: string[] }[]>("set_list");
  expect(sets.find((s) => s.id === workshopSet.id)?.questionIds).toEqual(
    workshopSet.questionIds,
  );
  const first = workshopQuestions[0];
  await rpc("bank_save", [
    JSON.stringify({ ...first, title: "Edited for tomorrow" }),
  ]);
  await seedWorkshop(db, DEMO_ADMIN);
  expect(
    (await rpc<{ id: string; title: string }[]>("bank_list")).find(
      (q) => q.id === first.id,
    )?.title,
  ).toBe("Edited for tomorrow");
});
it("subtracts opened hints before doubling a star and protects the active answer's value", async () => {
  const q = workshopQuestions.find((q) => q.tags.includes("Slide 2"))!;
  const s = await rpc<{ id: string; code: string }>("session_create", [
    "Hint scoring",
    [q.id],
    60,
    [q.id],
    null,
    [],
    50,
  ]);
  const token = crypto.randomUUID();
  await rpc("session_join", [s.code, "Player", token], false);
  let g = await rpc("session_view", [s.id]);
  g = await rpc("session_control", [s.id, "start", g.roundId]);
  g = await rpc("session_hint", [s.id, g.roundId]);
  expect(g.question.points).toBe(150);
  await rpc("star_select", [s.id, g.roundId, token, true], false);
  g = await rpc("buzz_control", [s.id, g.roundId, true]);
  g = await rpc("buzz_submit", [s.id, g.roundId, token, g.buzzId], false);
  await expect(rpc("session_hint", [s.id, g.roundId])).rejects.toThrow(
    "Chấm lượt",
  );
  g = await rpc("buzz_grade", [s.id, g.roundId, g.myId, true]);
  expect(g.standings[0].score).toBe(300);
  g = await rpc("session_control", [s.id, "reveal", g.roundId]);
  expect(g.standings[0].score).toBe(300);
});
it("keeps optional deductions off and hides answer images until reveal", async () => {
  const q = workshopQuestions.find((q) => q.answerImage)!;
  const s = await rpc<{ id: string; view_token: string }>("session_create", [
    "No players needed",
    [q.id],
    60,
  ]);
  let g = await rpc("session_view", [s.id, s.view_token], false);
  expect(g.question).not.toHaveProperty("answerImage");
  g = await rpc("session_control", [s.id, "start", g.roundId]);
  g = await rpc("session_hint", [s.id, g.roundId]);
  expect(g.question.points).toBe(q.points);
  g = await rpc("session_control", [s.id, "reveal", g.roundId]);
  expect(g.question.answerImage).toBe(q.answerImage);
});
