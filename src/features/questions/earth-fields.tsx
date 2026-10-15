"use client";
import type { Question } from "./model";
type EarthQuestion = Exclude<Question, { kind: "choice" | "puzzle" }>;

export function EarthFields({
  question: q,
  onChange,
}: {
  question: EarthQuestion;
  onChange: (q: Question) => void;
}) {
  const legacyAnswer =
    (q.kind === "locate" && q.target && q.bounds) ||
    (q.kind === "change" && q.regions.length > 0);
  return (
    <label>
      Đáp án
      <textarea
        rows={2}
        value={q.solution || ""}
        maxLength={q.kind === "place" ? 160 : 220}
        required={!legacyAnswer}
        placeholder="Đáp án hoặc nội dung MC dùng để chấm"
        onChange={(e) => onChange({ ...q, solution: e.target.value })}
      />
    </label>
  );
}
