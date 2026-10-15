import type { Difficulty } from "@/features/questions/difficulty";
export function starterBase(n: number, difficulty: Difficulty) {
  return {
    id: `7b0c6f11-5dd8-4d44-8ba7-b03a2bea${n}`,
    title: "",
    image: "",
    difficulty,
    seconds: { easy: 90, medium: 120, hard: 180 }[difficulty],
    points: { easy: 200, medium: 300, hard: 400 }[difficulty],
    explanation: "",
    hints: [] as string[],
    tags: ["Minh họa", "Bộ khởi động"],
  };
}
export const scenes = {
  farm: "/starter/farm",
  forest: "/starter/forest",
  port: "/starter/port",
} as const;
