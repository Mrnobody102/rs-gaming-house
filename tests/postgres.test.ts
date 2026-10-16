import { expect, it } from "vitest";
import { openPostgresDatabase } from "../src/server/postgres-database";
import { DEMO_ADMIN } from "../src/server/database-schema";
import { newQuestion } from "../src/features/games/catalog";
import type { GameView } from "../src/features/sessions/model";

it.skipIf(!process.env.TEST_DATABASE_URL)(
  "PostgreSQL preserves per-request claims, rolls back errors and selects one winner under concurrent transactions",
  async () => {
    const db = await openPostgresDatabase(process.env.TEST_DATABASE_URL!);
    const question = {
      ...newQuestion("riddle"),
      title: "PostgreSQL load test",
      solution: "Answer",
      hints: [],
    };
    let roomId: string | undefined;
    async function rpc<T = GameView>(
      name: string,
      args: unknown[],
      admin = false,
    ) {
      return db.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
          admin ? DEMO_ADMIN : "",
        ]);
        const result = await tx.query<{ value: T }>(
          `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as value`,
          args.map((value) =>
            value && typeof value === "object" && !Array.isArray(value)
              ? JSON.stringify(value)
              : value,
          ),
        );
        return result.rows[0].value;
      });
    }
    try {
      await rpc("bank_save", [question], true);
      const room = await rpc<{ id: string; code: string }>(
        "session_create",
        ["PostgreSQL load", [question.id], 60],
        true,
      );
      roomId = room.id;
      const tokens = Array.from({ length: 60 }, () => crypto.randomUUID());
      await Promise.all(
        tokens.map((token, i) =>
          rpc("session_join", [room.code, `PG ${i}`, token]),
        ),
      );
      let game = await rpc("session_view", [room.id, ""], true);
      game = await rpc(
        "session_control",
        [room.id, "start", game.roundId],
        true,
      );
      game = await rpc("buzz_control", [room.id, game.roundId, true], true);
      const results = await Promise.all(
        tokens.map((token) =>
          rpc("buzz_submit", [room.id, game.roundId, token, game.buzzId]),
        ),
      );
      const winner = results[0].buzzWinner!.id;
      expect(new Set(results.map((result) => result.buzzWinner?.id))).toEqual(
        new Set([winner]),
      );
      expect(results.every((result) => !result.host && !result.buzzOpen)).toBe(
        true,
      );
      await expect(
        rpc("buzz_grade", [room.id, game.roundId, winner, true]),
      ).rejects.toThrow();
      game = await rpc(
        "buzz_grade",
        [room.id, game.roundId, winner, true],
        true,
      );
      expect(
        game.standings
          .filter((player) => player.score > 0)
          .map((player) => player.id),
      ).toEqual([winner]);
      const gradeAgain = await rpc(
        "buzz_grade",
        [room.id, game.roundId, winner, true],
        true,
      );
      expect(gradeAgain.standings).toEqual(game.standings);
      await expect(
        db.transaction(async (tx) => {
          await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
            DEMO_ADMIN,
          ]);
          await tx.query(
            "update public.game_sessions set title='Must roll back' where id=$1",
            [room.id],
          );
          throw new Error("rollback probe");
        }),
      ).rejects.toThrow("rollback probe");
      expect((await rpc("session_view", [room.id, ""], true)).title).toBe(
        "PostgreSQL load",
      );
      const claims = await Promise.all(
        Array.from({ length: 12 }, () =>
          db.query<{ uid: string | null }>("select auth.uid() as uid"),
        ),
      );
      expect(claims.every((result) => result.rows[0].uid === null)).toBe(true);
    } finally {
      if (roomId) await rpc("session_delete", [roomId], true);
      await rpc("bank_archive", [question.id], true);
      await db.close();
    }
  },
  60000,
);
