import { z } from "zod";
import { target } from "./schemas/common";
import { choiceSchema } from "./schemas/choice";
import { puzzleSchema } from "./schemas/puzzle";
import { placeSchema } from "./schemas/place";
import { locateSchema } from "./schemas/locate";
import { changeSchema } from "./schemas/change";
import { riddleSchema } from "./schemas/riddle";
export type Coordinate = z.infer<typeof target>;
export type Region = { x: number; y: number; radius: number; label: string };
export const questionSchema = z.discriminatedUnion("kind", [
  choiceSchema,
  puzzleSchema,
  placeSchema,
  locateSchema,
  changeSchema,
  riddleSchema,
]);
export type Question = z.infer<typeof questionSchema>;
type WithoutAnswer<T> = T extends Question
  ? Omit<T, "correct" | "explanation" | "solution" | "target" | "regions"> & {
      correct?: number;
      explanation?: string;
      solution?: string;
      target?: Coordinate;
      regions?: Region[];
    }
  : never;
export type PublicQuestion = WithoutAnswer<Question>;
export type Answer = { choice: number } | { tiles: number[] };
