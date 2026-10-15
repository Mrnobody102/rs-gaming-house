import { z } from "zod";
import { common, media } from "./common";
export const puzzleSchema = z.object({
  ...common,
  kind: z.literal("puzzle"),
  image: media.refine(Boolean, "Chọn ảnh cho puzzle."),
  grid: z.union([z.literal(2), z.literal(3)]),
});
