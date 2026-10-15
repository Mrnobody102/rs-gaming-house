import { z } from "zod";
import { common, media, bounds, target } from "./common";
export const locateSchema = z
  .object({
    ...common,
    kind: z.literal("locate"),
    image: media.refine(Boolean, "Chọn ảnh câu hỏi."),
    afterImage: media.default(""),
    solution: z.string().trim().max(220).default(""),
    // Retain calibrated questions authored before the simpler image editor.
    bounds: bounds.optional(),
    target: target.optional(),
    tolerance: z.number().min(1).max(100000).default(100),
  })
  .refine((q) => Boolean(q.solution || (q.bounds && q.target)), "Nhập đáp án.")
  .refine(
    (q) =>
      !q.target ||
      !q.bounds ||
      (q.target.lng >= q.bounds.west &&
        q.target.lng <= q.bounds.east &&
        q.target.lat >= q.bounds.south &&
        q.target.lat <= q.bounds.north),
    "Đáp án phải nằm trong phạm vi ảnh.",
  );
