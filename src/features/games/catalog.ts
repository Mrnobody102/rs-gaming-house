import type { Question } from "./question-schema";
import { randomId } from "@/shared/client/random";
export const gameCatalog = {
  riddle: { label: "Đoán đáp án", answerMode: "buzz" },
  place: { label: "Đoán địa danh", answerMode: "buzz" },
  locate: { label: "Truy tìm tọa độ", answerMode: "buzz" },
  change: { label: "Giải mã biến động", answerMode: "buzz" },
  choice: { label: "Trắc nghiệm", answerMode: "choice" },
  puzzle: { label: "Ghép ảnh", answerMode: "puzzle" },
} as const;
export const kindLabels = Object.fromEntries(
  Object.entries(gameCatalog).map(([key, value]) => [key, value.label]),
) as Record<keyof typeof gameCatalog, string>;

export function newQuestion(kind: Question["kind"]): Question {
  const base = {
    id: randomId(),
    title: "",
    image: "",
    seconds: 60,
    points: 300,
    hopeStar: false,
    explanation: "",
    tags: [],
    hints: [],
    difficulty: "medium" as const,
  };
  switch (kind) {
    case "riddle":
      return { ...base, kind, solution: "", hints: ["", "", ""] };
    case "choice":
      return { ...base, kind, options: ["", "", "", ""], correct: 0 };
    case "puzzle":
      return { ...base, kind, seconds: 120, grid: 2 };
    case "place":
      return { ...base, kind, solution: "" };
    case "locate":
      return {
        ...base,
        kind,
        seconds: 120,
        afterImage: "",
        solution: "",
        tolerance: 100,
      };
    case "change":
      return {
        ...base,
        kind,
        seconds: 90,
        afterImage: "",
        solution: "",
        beforeLabel: "Trước",
        afterLabel: "Sau",
        regions: [],
      };
  }
}
