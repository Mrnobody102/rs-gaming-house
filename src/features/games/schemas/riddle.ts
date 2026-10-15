import { z } from "zod";
import { common } from "./common";
import { hintSchema } from "../hints";
export const riddleSchema = z.object({
  ...common,
  kind: z.literal("riddle"),
  solution: z.string().trim().min(1, "Nhập đáp án.").max(220),
  hints: z.array(hintSchema).max(3, "Tối đa 3 gợi ý.").default([]),
});
