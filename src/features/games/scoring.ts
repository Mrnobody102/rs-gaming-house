import type { Difficulty } from "@/features/questions/difficulty";

export const difficultyPoints = { easy: 200, medium: 300, hard: 400 } as const;
export function pointsForDifficulty(difficulty?: Difficulty) {
  return difficultyPoints[difficulty || "medium"];
}
