import type { Question } from "./model";
import { difficultyOf } from "./difficulty";
export function filterQuestions(
  questions: Question[],
  filter: { query: string; kind: string; difficulty: string },
) {
  const search = filter.query.trim().toLocaleLowerCase("vi");
  return questions.filter(
    (q) =>
      (filter.kind === "all" || q.kind === filter.kind) &&
      (filter.difficulty === "all" || difficultyOf(q) === filter.difficulty) &&
      `${q.title} ${q.tags.join(" ")}`.toLocaleLowerCase("vi").includes(search),
  );
}
