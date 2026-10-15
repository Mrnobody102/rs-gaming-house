import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { initializeDatabase, DEMO_ADMIN } from "../src/server/local-database";
import { starterQuestions as samples } from "../src/content/starter";
import type { GameView, SessionPlan } from "../src/features/sessions/model";
import { distanceMeters } from "../src/features/play/earth-games";
import { acceptSnapshot } from "../src/features/play/state";
import { newQuestion, questionSchema } from "../src/features/questions/model";
let db: PGlite;
async function rpc<T = GameView>(
  name: string,
  args: unknown[],
  admin = false,
): Promise<T> {
  if (name === "buzz_submit" && args.length === 3) {
    const { rows } = await db.query<{ id: string | null }>(
      "select buzz_open_id as id from public.session_rounds where id=$1",
      [args[1]],
    );
    args = [...args, rows[0]?.id];
  }
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      admin ? DEMO_ADMIN : "",
    ]);
    const { rows } = await tx.query<{ value: T }>(
      `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as value`,
      args.map((v) =>
        v && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : v,
      ),
    );
    return rows[0].value;
  });
}
async function room(kind: string) {
  const q = samples.find((q) => q.kind === kind)!;
  return rpc<{ id: string; code: string; view_token: string }>(
    "session_create",
    [kind, [q.id], 60],
    true,
  );
}
beforeAll(async () => {
  db = new PGlite();
  await initializeDatabase(db);
  for (const q of samples) await rpc("bank_save", [q], true);
}, 30000);
afterAll(async () => {
  await db.close();
});
describe("Earth observation games", () => {
  it("uses server-timed quiz BUZZ, rejects stale openings and keeps the first winner", async () => {
    const q = questionSchema.parse({
      ...newQuestion("choice"),
      title: "Quiz buzz",
      options: ["Yes", "No"],
      correct: 0,
    });
    await rpc("bank_save", [q], true);
    const s = await rpc<{ id: string; code: string }>(
      "session_create",
      ["Quiz buzz", [q.id], 60],
      true,
    );
    const a = crypto.randomUUID(),
      b = crypto.randomUUID();
    await rpc("session_join", [s.code, "First", a]);
    await rpc("session_join", [s.code, "Second", b]);
    let g = await rpc("session_view", [s.id, ""], true);
    g = await rpc("session_control", [s.id, "start", g.roundId], true);
    expect(g.deadline).toBeNull();
    await expect(
      rpc("answer_submit", [s.id, g.roundId, a, { choice: 0 }]),
    ).rejects.toThrow("BUZZ");
    g = await rpc("buzz_control", [s.id, g.roundId, true], true);
    const oldWindow = g.buzzId;
    expect(
      (await rpc("buzz_control", [s.id, g.roundId, true], true)).buzzId,
    ).toBe(oldWindow);
    await rpc("buzz_control", [s.id, g.roundId, false], true);
    g = await rpc("buzz_control", [s.id, g.roundId, true], true);
    expect(g.buzzId).not.toBe(oldWindow);
    await expect(
      rpc("buzz_submit", [s.id, g.roundId, a, oldWindow]),
    ).rejects.toThrow("thay đổi");
    await db.query(
      "update public.session_rounds set buzz_opened_at=clock_timestamp()-interval '0.5 seconds' where id=$1",
      [g.roundId],
    );
    const first = await rpc("buzz_submit", [s.id, g.roundId, a, g.buzzId]);
    const later = await rpc("buzz_submit", [s.id, g.roundId, b, g.buzzId]);
    expect(later.buzzWinner).toEqual(first.buzzWinner);
    expect(first.buzzWinner?.id).toBe(first.myId);
    expect(first.buzzWinner?.elapsedMs).toBeGreaterThanOrEqual(500);
    expect(first.buzzWinner?.elapsedMs).toBeLessThan(3000);
    g = await rpc("buzz_grade", [s.id, g.roundId, first.myId, true], true);
    expect(g.phase).toBe("result");
    expect(g.standings[0].score).toBe(300);
  });
  it("keeps room snapshots when editing a lobby after bank edits or archival", async () => {
    const qs = ["Original main", "Original reserve", "New main"].map((title) =>
      questionSchema.parse({
        ...newQuestion("riddle"),
        title,
        solution: title,
        hints: [],
      }),
    );
    for (const q of qs) await rpc("bank_save", [q], true);
    const s = await rpc<{ id: string }>(
      "session_create",
      ["Frozen room", [qs[0].id], 60, [], null, [qs[1].id]],
      true,
    );
    for (const q of qs.slice(0, 2)) {
      await rpc(
        "bank_save",
        [{ ...q, title: "Changed in bank", solution: "Changed" }],
        true,
      );
      await rpc("bank_archive", [q.id], true);
    }
    const ids = [qs[2].id, qs[0].id];
    await rpc(
      "session_plan_save",
      [s.id, "Renamed room", ids, 50, [qs[0].id], [qs[1].id]],
      true,
    );
    const plan = await rpc<SessionPlan>("session_plan", [s.id], true);
    expect(plan.questions.map((q) => q.title)).toEqual([
      "New main",
      "Original main",
    ]);
    expect(plan.questions[1]).toMatchObject({ solution: "Original main" });
    expect(plan.questions[1].hopeStar).toBe(true);
    expect(plan.reserveQuestions?.[0].title).toBe("Original reserve");
    // Failed changes must roll back both the order and the reserve selection.
    await expect(
      rpc(
        "session_plan_save",
        [s.id, "Invalid", ids, 50, [], [qs[0].id]],
        true,
      ),
    ).rejects.toThrow("trùng câu chính");
    await expect(
      rpc(
        "session_plan_save",
        [s.id, "Invalid", [crypto.randomUUID()], 50, [], []],
        true,
      ),
    ).rejects.toThrow("lưu trữ");
    expect(await rpc<SessionPlan>("session_plan", [s.id], true)).toEqual(plan);
    // Archival still prevents these questions from being selected for a new room.
    await expect(
      rpc("session_create", ["New room", [qs[0].id], 60], true),
    ).rejects.toThrow();
  });
  it("saves a question into its set atomically and prevents main/reserve overlap", async () => {
    const setId = crypto.randomUUID(),
      missingId = crypto.randomUUID();
    const q = questionSchema.parse({
      ...newQuestion("riddle"),
      title: "Atomic question",
      solution: "Answer",
      hints: [],
    });
    await expect(rpc("bank_save_to_set", [missingId, q], true)).rejects.toThrow(
      "Không tìm thấy bộ",
    );
    expect(
      (await rpc<{ id: string }[]>("bank_list", [], true)).some(
        (item) => item.id === q.id,
      ),
    ).toBe(false);
    await rpc("set_save", [setId, "Atomic set", [], [], []], true);
    await rpc("bank_save_to_set", [setId, q], true);
    let sets = await rpc<{ id: string; questionIds: string[] }[]>(
      "set_list",
      [],
      true,
    );
    expect(sets.find((s) => s.id === setId)?.questionIds).toEqual([q.id]);
    await rpc("set_save", [setId, "Atomic set", [], [], [q.id]], true);
    await expect(rpc("set_add_question", [setId, q.id], true)).rejects.toThrow(
      "câu dự bị",
    );
    await expect(
      rpc(
        "bank_save_to_set",
        [setId, { ...q, title: "Must not overwrite" }],
        true,
      ),
    ).rejects.toThrow("câu dự bị");
    const stored = await rpc<{ id: string; title: string }[]>(
      "bank_list",
      [],
      true,
    );
    expect(stored.find((item) => item.id === q.id)?.title).toBe(
      "Atomic question",
    );
    const ids = [];
    for (let i = 0; i < 50; i++) {
      const item = { ...q, id: crypto.randomUUID() };
      await rpc("bank_save", [item], true);
      ids.push(item.id);
    }
    await rpc("set_save", [setId, "Full set", ids, [], []], true);
    const extra = { ...q, id: crypto.randomUUID() };
    await expect(rpc("bank_save_to_set", [setId, extra], true)).rejects.toThrow(
      "50 câu",
    );
    expect(
      (await rpc<{ id: string }[]>("bank_list", [], true)).some(
        (item) => item.id === extra.id,
      ),
    ).toBe(false);
  });
  it("normalizes names, rejects equivalent names including concurrent joins, and reconnects the same token", async () => {
    const s = await room("place"),
      token = crypto.randomUUID();
    const first = await rpc<{ participantId: string }>("session_join", [
      s.code,
      "  Linh   Nguyễn  ",
      token,
    ]);
    for (const name of [
      "linh nguyễn",
      "LINH\u00a0NGUYỄN",
      "Linh\u200b Nguyễn",
      "Linh Nguye\u0302\u0303n",
    ])
      await expect(
        rpc("session_join", [s.code, name, crypto.randomUUID()]),
      ).rejects.toThrow("đã có");
    expect(
      (
        await rpc<{ participantId: string }>("session_join", [
          s.code,
          "Linh Nguyễn",
          token,
        ])
      ).participantId,
    ).toBe(first.participantId);
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        rpc("session_join", [s.code, "Same name", crypto.randomUUID()]),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const name of ["   ", "\u200b\ufeff", "a".repeat(41)])
      await expect(
        rpc("session_join", [s.code, name, crypto.randomUUID()]),
      ).rejects.toThrow("1 đến 40");
  });
  it("resolves tied prize places using reserve BUZZ rounds without points or stars", async () => {
    const main = questionSchema.parse({
      ...newQuestion("choice"),
      interaction: "submit",
      title: "Normal round",
      difficulty: "easy",
      options: ["Yes", "No"],
      correct: 0,
    });
    const reserves = [1, 2].map((n) =>
      questionSchema.parse({
        ...newQuestion("riddle"),
        title: `Reserve ${n}`,
        solution: "Answer",
        hints: [],
      }),
    );
    for (const q of [main, ...reserves]) await rpc("bank_save", [q], true);
    const s = await rpc<{ id: string; code: string }>(
      "session_create",
      ["Final", [main.id], 60, [], null, reserves.map((q) => q.id)],
      true,
    );
    const tokens = Array.from({ length: 4 }, () => crypto.randomUUID());
    for (const [i, t] of tokens.entries())
      await rpc("session_join", [s.code, "ABCD"[i], t]);
    let g = await rpc("session_view", [s.id, ""], true);
    g = await rpc("session_control", [s.id, "start", g.roundId], true);
    for (const token of tokens.slice(0, 3))
      await rpc("answer_submit", [s.id, g.roundId, token, { choice: 0 }]);
    g = await rpc("session_control", [s.id, "reveal", g.roundId], true);
    expect(g.tiebreak.pending).toBe(true);
    expect(g.tiebreak.reserves).toBe(2);
    await expect(rpc("tie_start", [s.id, g.roundId])).rejects.toThrow(
      "quản trị",
    );
    g = await rpc("tie_start", [s.id, g.roundId], true);
    expect(g.question.id).toBe(reserves[0].id);
    expect(g.question.points).toBe(0);
    expect(g.question.hopeStar).toBe(false);
    await expect(
      rpc("star_select", [s.id, g.roundId, tokens[0], true]),
    ).rejects.toThrow("chưa cho phép");
    await rpc("buzz_control", [s.id, g.roundId, true], true);
    await expect(
      rpc("buzz_submit", [s.id, g.roundId, tokens[3]]),
    ).rejects.toThrow("nhóm đồng điểm");
    g = await rpc("buzz_submit", [s.id, g.roundId, tokens[0]]);
    await rpc("buzz_grade", [s.id, g.roundId, g.myId, false], true);
    await rpc("buzz_control", [s.id, g.roundId, true], true);
    g = await rpc("buzz_submit", [s.id, g.roundId, tokens[1]]);
    g = await rpc("buzz_grade", [s.id, g.roundId, g.myId, true], true);
    expect(g.standings[0].name).toBe("B");
    expect(g.standings[0].score).toBe(200);
    expect(g.tiebreak.candidates.map((p) => p.name)).toEqual(["A", "C"]);
    g = await rpc("tie_start", [s.id, g.roundId], true);
    await rpc("buzz_control", [s.id, g.roundId, true], true);
    await expect(
      rpc("buzz_submit", [s.id, g.roundId, tokens[1]]),
    ).rejects.toThrow("nhóm đồng điểm");
    g = await rpc("buzz_submit", [s.id, g.roundId, tokens[2]]);
    g = await rpc("buzz_grade", [s.id, g.roundId, g.myId, true], true);
    expect(g.standings.map((p) => p.name)).toEqual(["B", "C", "A", "D"]);
    expect(g.standings.map((p) => p.rank)).toEqual([1, 2, 3, 4]);
    expect(g.standings.map((p) => p.score)).toEqual([200, 200, 200, 0]);
    expect(g.tiebreak.pending).toBe(false);
    await expect(rpc("tie_start", [s.id, g.roundId], true)).rejects.toThrow(
      "Không có nhóm",
    );
  });
  it("hides image hints until the MC opens them and keeps their order", async () => {
    const q = questionSchema.parse({
      ...newQuestion("riddle"),
      title: "Mixed hints",
      solution: "Answer",
      hints: [
        "First",
        { type: "image", image: "/starter/farm-before.svg" },
        { type: "text", text: "Third" },
      ],
    });
    await rpc("bank_save", [q], true);
    const s = await rpc<{ id: string; view_token: string }>(
      "session_create",
      ["Mixed", [q.id], 60],
      true,
    );
    let g = await rpc("session_view", [s.id, s.view_token]);
    expect(g.question.hints).toEqual([]);
    g = await rpc("session_control", [s.id, "start", g.roundId], true);
    g = await rpc("session_hint", [s.id, g.roundId], true);
    expect(g.question.hints).toEqual(["First"]);
    g = await rpc("session_hint", [s.id, g.roundId], true);
    expect(g.question.hints[1]).toEqual({
      type: "image",
      image: "/starter/farm-before.svg",
    });
    expect(g.question.hints).toHaveLength(2);
    g = await rpc("session_hint", [s.id, g.roundId], true);
    expect(g.question.hints).toEqual(q.hints);
  });
  it("prepares a draft set and edits a room plan only before starting", async () => {
    const setId = crypto.randomUUID(),
      ids = samples.slice(0, 10).map((q) => q.id);
    await rpc("set_save", [setId, "Tomorrow", [], []], true);
    for (const id of ids) await rpc("set_add_question", [setId, id], true);
    await rpc("set_save", [setId, "Tomorrow", ids, [ids[0]]], true);
    const s = await rpc<{ id: string }>(
      "session_create",
      ["Tomorrow", ids, 60, [ids[0]], setId],
      true,
    );
    let g = await rpc("session_view", [s.id, ""], true);
    expect(g.total).toBe(10);
    expect(g.question.hopeStar).toBe(true);
    await rpc(
      "session_plan_save",
      [s.id, "Reordered", [...ids].reverse(), 50, []],
      true,
    );
    g = await rpc("session_view", [s.id, ""], true);
    expect(g.question.id).toBe(ids.at(-1));
    expect(g.question.hopeStar).toBe(false);
    const sets = await rpc<
      { id: string; questionIds: string[]; starQuestionIds: string[] }[]
    >("set_list", [], true);
    expect(sets.find((s) => s.id === setId)?.starQuestionIds).toEqual([ids[0]]);
    expect(sets.find((s) => s.id === setId)?.questionIds).toEqual(ids);
    await rpc("session_control", [s.id, "start", g.roundId], true);
    await expect(
      rpc("session_plan_save", [s.id, "Too late", ids, 50, []], true),
    ).rejects.toThrow("trước khi bắt đầu");
    await expect(rpc("session_plan", [s.id])).rejects.toThrow("quản trị");
  });
  it("uses one star only when graded, doubles a correct answer once, and consumes a wrong answer's star", async () => {
    const qs = ["easy", "hard"].map((difficulty) =>
      questionSchema.parse({
        ...newQuestion("riddle"),
        title: "Star question",
        solution: "Answer",
        difficulty,
        hints: [],
      }),
    );
    for (const q of qs) await rpc("bank_save", [q], true);
    const ids = qs.map((q) => q.id);
    const s = await rpc<{ id: string; code: string }>(
      "session_create",
      ["Stars", ids, 60, ids],
      true,
    );
    const a = crypto.randomUUID(),
      b = crypto.randomUUID();
    await rpc("session_join", [s.code, "A", a]);
    await rpc("session_join", [s.code, "B", b]);
    let g = await rpc("session_view", [s.id, ""], true);
    await expect(
      rpc("star_select", [s.id, g.roundId, a, true]),
    ).rejects.toThrow("chưa cho phép");
    g = await rpc("session_control", [s.id, "start", g.roundId], true);
    await rpc("star_select", [s.id, g.roundId, a, true]);
    await rpc("star_select", [s.id, g.roundId, b, true]);
    await rpc("buzz_control", [s.id, g.roundId, true], true);
    g = await rpc("buzz_submit", [s.id, g.roundId, a]);
    await expect(
      rpc("star_select", [s.id, g.roundId, a, false]),
    ).rejects.toThrow("trước khi trả lời");
    g = await rpc("buzz_grade", [s.id, g.roundId, g.myId, true], true);
    expect(g.standings.find((p) => p.name === "A")?.score).toBe(400);
    g = await rpc(
      "buzz_grade",
      [s.id, g.roundId, g.standings[0].id, true],
      true,
    );
    expect(g.standings[0].score).toBe(400);
    expect((await rpc("session_view", [s.id, b])).star.used).toBe(false);
    g = await rpc("session_control", [s.id, "next", g.roundId], true);
    expect(g.question.points).toBe(400);
    await expect(
      rpc("star_select", [s.id, g.roundId, a, true]),
    ).rejects.toThrow("đã dùng");
    await rpc("star_select", [s.id, g.roundId, b, true]);
    await rpc("buzz_control", [s.id, g.roundId, true], true);
    g = await rpc("buzz_submit", [s.id, g.roundId, b]);
    await rpc("buzz_grade", [s.id, g.roundId, g.myId, false], true);
    g = await rpc("session_view", [s.id, b]);
    expect(g.star.used).toBe(true);
    expect(g.standings.find((p) => p.name === "B")?.score).toBe(0);
  });
  it("keeps equal points tied regardless of correct answer count or response time", async () => {
    const qs = [1, 2].map(() =>
      questionSchema.parse({
        ...newQuestion("choice"),
        interaction: "submit",
        title: "Rank question",
        options: ["Yes", "No"],
        correct: 0,
        difficulty: "easy",
      }),
    );
    for (const q of qs) await rpc("bank_save", [q], true);
    const ids = qs.map((q) => q.id);
    const s = await rpc<{ id: string; code: string }>(
      "session_create",
      ["Rank", ids, 60, ids],
      true,
    );
    const tokens = ["A", "B", "C", "D"].map(() => crypto.randomUUID());
    for (const [i, token] of tokens.entries())
      await rpc("session_join", [s.code, "ABCD"[i], token]);
    let g = await rpc("session_view", [s.id, ""], true);
    g = await rpc("session_control", [s.id, "start", g.roundId], true);
    await rpc("star_select", [s.id, g.roundId, tokens[0], true]);
    for (const token of tokens.slice(0, 3))
      await rpc("answer_submit", [s.id, g.roundId, token, { choice: 0 }]);
    g = await rpc("session_control", [s.id, "reveal", g.roundId], true);
    expect(g.standings.find((p) => p.name === "A")?.score).toBe(400);
    g = await rpc("session_control", [s.id, "next", g.roundId], true);
    for (const token of tokens.slice(1, 3))
      await rpc("answer_submit", [s.id, g.roundId, token, { choice: 0 }]);
    await db.query(
      "update public.answers a set response_ms=case when p.name='B' then 2000 else 500 end from public.participants p where a.participant_id=p.id and p.session_id=$1",
      [s.id],
    );
    g = await rpc("session_control", [s.id, "reveal", g.roundId], true);
    expect(g.standings.slice(0, 3).every((p) => p.tied)).toBe(true);
    expect(g.tiebreak.pending).toBe(true);
    expect(g.standings.map((p) => p.rank)).toEqual([1, 1, 1, 4]);
    expect(g.standings.slice(0, 3).map((p) => p.score)).toEqual([
      400, 400, 400,
    ]);
  });
  it("saves image-and-text answers without coordinates or marked regions and keeps answers hidden until reveal", async () => {
    for (const kind of ["locate", "change"] as const) {
      const q = questionSchema.parse({
        ...newQuestion(kind),
        title: "Read the annotated image",
        image: "/starter/scene-farm-before.svg",
        solution: "Written answer",
        hints: ["First hint"],
        explanation: "More information",
      });
      await rpc("bank_save", [q], true);
      const s = await rpc<{ id: string }>(
        "session_create",
        [kind, [q.id], 60],
        true,
      );
      let g = await rpc("session_view", [s.id, ""], true);
      expect(g.question).not.toHaveProperty("solution");
      expect(g.question).not.toHaveProperty("explanation");
      g = await rpc("session_control", [s.id, "start", g.roundId], true);
      expect(g.deadline).toBeNull();
      g = await rpc("session_control", [s.id, "reveal", g.roundId], true);
      expect(g.question.solution).toBe("Written answer");
      expect(g.question.explanation).toBe("More information");
      expect(g.question).not.toHaveProperty("bounds");
    }
  });
  it("lets the MC open three hints, then grade a spoken answer without a timer", async () => {
    const s = await room("riddle"),
      token = crypto.randomUUID();
    await rpc("session_join", [s.code, "Speaker", token]);
    let g = await rpc("session_view", [s.id, ""], true);
    g = await rpc("session_control", [s.id, "start", g.roundId], true);
    expect(g.deadline).toBeNull();
    expect(g.question).not.toHaveProperty("solution");
    expect(g.question.hints).toEqual([]);
    for (let i = 1; i <= 3; i++) {
      g = await rpc("session_hint", [s.id, g.roundId], true);
      expect(g.question.hints).toHaveLength(i);
    }
    g = await rpc("buzz_control", [s.id, g.roundId, true], true);
    g = await rpc("buzz_submit", [s.id, g.roundId, token]);
    g = await rpc("buzz_grade", [s.id, g.roundId, g.myId, true], true);
    expect(g.phase).toBe("result");
    expect(g.question.solution).toBeTruthy();
    expect(g.standings[0].score).toBe(g.question.points);
  });
  it("redacts the place solution, location target, modern image and change regions before reveal", async () => {
    for (const kind of ["place", "locate", "change"]) {
      const s = await room(kind);
      let g = await rpc("session_view", [s.id, s.view_token]);
      expect(g.question).not.toHaveProperty("solution");
      expect(g.question).not.toHaveProperty("target");
      expect(g.question).not.toHaveProperty("regions");
      expect(g.question.hints).toEqual([]);
      if (kind === "locate")
        expect(g.question).not.toHaveProperty("afterImage");
      g = await rpc("session_control", [s.id, "start", g.roundId], true);
      g = await rpc("session_hint", [s.id, g.roundId], true);
      expect(g.question.hints).toHaveLength(1);
      await expect(rpc("session_hint", [s.id, g.roundId])).rejects.toThrow(
        "quản trị",
      );
      g = await rpc("session_control", [s.id, "reveal", g.roundId], true);
      expect(g.question).toHaveProperty(
        kind === "place"
          ? "solution"
          : kind === "locate"
            ? "target"
            : "regions",
      );
    }
  });
  it("selects exactly one BUZZ winner for 60 simultaneous requests and scores only that individual", async () => {
    const s = await room("place"),
      tokens = Array.from({ length: 60 }, () => crypto.randomUUID());
    await Promise.all(
      tokens.map((t, i) => rpc("session_join", [s.code, `Person ${i}`, t])),
    );
    let g = await rpc("session_view", [s.id, ""], true);
    g = await rpc("session_control", [s.id, "start", g.roundId], true);
    await expect(
      rpc("buzz_submit", [s.id, g.roundId, tokens[0]]),
    ).rejects.toThrow("chưa mở");
    g = await rpc("buzz_control", [s.id, g.roundId, true], true);
    await Promise.all(
      tokens.map((t) => rpc("buzz_submit", [s.id, g.roundId, t])),
    );
    g = await rpc("session_view", [s.id, ""], true);
    expect(g.buzzWinner).toBeTruthy();
    expect(g.buzzOpen).toBe(false);
    const winner = g.buzzWinner!.id;
    g = await rpc("buzz_grade", [s.id, g.roundId, winner, true], true);
    expect(g.phase).toBe("result");
    expect(g.standings.filter((p) => p.score > 0).map((p) => p.id)).toEqual([
      winner,
    ]);
    g = await rpc("buzz_grade", [s.id, g.roundId, winner, true], true);
    expect(g.standings.find((p) => p.id === winner)?.score).toBe(200);
  }, 30000);
  it("rejects forged answers and stale grades, and lets another individual BUZZ after a wrong answer", async () => {
    const s = await room("change"),
      a = crypto.randomUUID(),
      b = crypto.randomUUID();
    await rpc("session_join", [s.code, "A", a]);
    await rpc("session_join", [s.code, "B", b]);
    let g = await rpc("session_view", [s.id, ""], true);
    g = await rpc("session_control", [s.id, "start", g.roundId], true);
    await expect(
      rpc("answer_submit", [s.id, g.roundId, a, { tiles: [] }]),
    ).rejects.toThrow("BUZZ");
    g = await rpc("buzz_control", [s.id, g.roundId, true], true);
    g = await rpc("buzz_submit", [s.id, g.roundId, a]);
    const first = g.myId;
    g = await rpc("buzz_grade", [s.id, g.roundId, first, false], true);
    expect(g.buzzWinner).toBeNull();
    g = await rpc("buzz_control", [s.id, g.roundId, true], true);
    await expect(rpc("buzz_submit", [s.id, g.roundId, a])).rejects.toThrow(
      "đã trả lời",
    );
    g = await rpc("buzz_submit", [s.id, g.roundId, b]);
    await rpc("buzz_grade", [s.id, g.roundId, first, false], true);
    g = await rpc("session_view", [s.id, b]);
    expect(g.buzzWinner?.id).toBe(g.myId);
    await expect(
      rpc("buzz_grade", [s.id, g.roundId, g.myId, true]),
    ).rejects.toThrow("quản trị");
    g = await rpc("buzz_grade", [s.id, g.roundId, g.myId, true], true);
    expect(g.standings.find((p) => p.name === "A")?.score).toBe(0);
    expect(g.standings.find((p) => p.name === "B")?.score).toBe(300);
  });
  it("shares an MC's WGS84 guess and validates its extent", async () => {
    const s = await room("locate");
    let g = await rpc("session_view", [s.id, ""], true);
    g = await rpc("session_control", [s.id, "start", g.roundId], true);
    await expect(
      rpc("session_guess", [s.id, g.roundId, 0, 0], true),
    ).rejects.toThrow("phạm vi");
    await rpc("session_guess", [s.id, g.roundId, 105.81, 21.01], true);
    g = await rpc("session_view", [s.id, s.view_token]);
    expect(g.guess).toEqual({ lng: 105.81, lat: 21.01 });
    expect(g.question).not.toHaveProperty("target");
  });
  it("computes geographic distances and keeps newer results when polling responses arrive late", () => {
    expect(distanceMeters({ lng: 0, lat: 0 }, { lng: 0, lat: 1 })).toBeCloseTo(
      111195.08,
      0,
    );
    expect(distanceMeters({ lng: 105, lat: 21 }, { lng: 105, lat: 21 })).toBe(
      0,
    );
    const latest = {
      revision: 3,
      serverTime: "2026-10-15T00:00:03Z",
      phase: "result",
    } as GameView;
    expect(acceptSnapshot(latest, { ...latest, revision: 2 })).toBe(latest);
    expect(
      acceptSnapshot(latest, { ...latest, serverTime: "2026-10-15T00:00:02Z" }),
    ).toBe(latest);
  });
});
