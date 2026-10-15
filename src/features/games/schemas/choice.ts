import { z } from "zod";
import { common } from "./common";
export const choiceSchema = z
  .object({
    ...common,
    kind: z.literal("choice"),
    options: z
      .array(
        z
          .string()
          .trim()
          .min(1, "Điền nội dung đáp án.")
          .max(160, "Mỗi đáp án tối đa 160 ký tự."),
      )
      .min(2, "Cần ít nhất hai đáp án.")
      .max(4),
    correct: z.number().int().min(0).max(3),
  })
  .refine(
    (q) =>
      new Set(
        q.options.map((o) =>
          o.normalize("NFKC").replace(/\s+/g, " ").toLocaleLowerCase("vi"),
        ),
      ).size === q.options.length,
    "Các đáp án không được trùng nhau.",
  )
  .refine((q) => q.correct < q.options.length, "Chọn đáp án đúng.");
