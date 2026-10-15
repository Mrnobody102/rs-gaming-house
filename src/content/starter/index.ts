import { samples } from "@/features/questions/samples";
import { placeQuestions } from "./place";
import { locateQuestions } from "./locate";
import { changeQuestions } from "./change";
import { choiceQuestions } from "./choice";
import { puzzleQuestions } from "./puzzle";
import { riddleQuestions } from "./riddle";
export const starterQuestions = [
  ...riddleQuestions,
  ...samples.map((q) =>
    q.kind === "choice" ? { ...q, interaction: "buzz" as const } : q,
  ),
  ...placeQuestions,
  ...locateQuestions,
  ...changeQuestions,
  ...choiceQuestions,
  ...puzzleQuestions,
];
