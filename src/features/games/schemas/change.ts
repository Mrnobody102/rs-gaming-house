import { z } from "zod";
import { common, media } from "./common";
export const changeSchema = z
  .object({
    ...common,
    kind: z.literal("change"),
    image: media.refine(Boolean, "Chọn ảnh câu hỏi."),
    afterImage: media.default(""),
    solution: z.string().trim().max(220).default(""),
    beforeLabel: z.string().trim().min(1).max(40).default("Trước"),
    afterLabel: z.string().trim().min(1).max(40).default("Sau"),
    regions: z
      .array(
        z.object({
          x: z.number().min(0).max(100),
          y: z.number().min(0).max(100),
          radius: z.number().min(1).max(40),
          label: z.string().trim().min(1).max(160),
        }),
      )
      .max(12)
      .default([]),
  })
  .refine((q) => Boolean(q.solution || q.regions.length), "Nhập đáp án.");
