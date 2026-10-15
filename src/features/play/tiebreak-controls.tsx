"use client";
import { useEffect, useState } from "react";
import { usesBuzz } from "@/features/games/catalog";
import type { Question } from "@/features/questions/model";
import type { GameView, SessionPlan } from "@/features/sessions/model";
import { command } from "@/shared/client/api";

export function TiebreakControls({
  game,
  busy,
  onRun,
}: {
  game: GameView;
  busy: boolean;
  onRun: (name: string, args: object) => Promise<void>;
}) {
  const [bank, setBank] = useState<Question[]>([]),
    [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (game.tiebreak.reserves > 0) return;
    Promise.all([
      command<Question[]>("bank_list"),
      command<SessionPlan>("session_plan", { p_id: game.id }),
    ])
      .then(([list, plan]) => {
        const seen = new Set([...plan.questionIds, ...plan.reserveQuestionIds]);
        const choices = list.filter((q) => !seen.has(q.id) && usesBuzz(q));
        setBank(choices);
        setSelected(choices[0]?.id || "");
      })
      .catch((e) => setError(e.message));
  }, [game.id, game.tiebreak.reserves]);
  return (
    <section className="tiebreak-controls" aria-label="Phân hạng đồng điểm">
      <strong>Phân hạng bằng câu dự bị</strong>
      <p>{game.tiebreak.candidates.map((p) => p.name).join(" · ")}</p>
      {game.tiebreak.reserves > 0 ? (
        <button
          className="button primary"
          disabled={busy}
          onClick={() => onRun("tie_start", { p_round_id: game.roundId })}
        >
          Chơi câu dự bị
        </button>
      ) : (
        <div className="tie-add-question">
          <select
            aria-label="Chọn câu dự bị"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {bank.map((q) => (
              <option value={q.id} key={q.id}>
                {q.title}
              </option>
            ))}
          </select>
          <button
            className="button secondary"
            disabled={busy || !selected}
            onClick={() =>
              onRun("tie_reserve_add", { p_question_id: selected })
            }
          >
            Thêm câu dự bị
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
