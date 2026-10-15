export const difficultyLabels = {
  easy: "Dễ",
  medium: "Vừa",
  hard: "Khó",
} as const;
export type Difficulty = keyof typeof difficultyLabels;
export function difficultyOf(q: { difficulty?: Difficulty }) {
  return q.difficulty || "medium";
}
