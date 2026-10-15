import { samples } from "@/features/questions/samples";
import { placeQuestions } from "./place";
import { locateQuestions } from "./locate";
import { changeQuestions } from "./change";
import { choiceQuestions } from "./choice";
import { puzzleQuestions } from "./puzzle";
import { riddleQuestions } from "./riddle";
export const starterQuestions = [
  ...riddleQuestions,
  ...samples,
  ...placeQuestions,
  ...locateQuestions,
  ...changeQuestions,
  ...choiceQuestions,
  ...puzzleQuestions,
];
