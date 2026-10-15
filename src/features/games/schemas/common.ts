import { z } from "zod";
import { media } from "./media";
import { hintSchema } from "../hints";
export { media } from "./media";
export const common = {
  id: z.uuid(),
  title: z
    .string()
    .trim()
    .min(3, "Nhập câu hỏi ít nhất 3 ký tự.")
    .max(220, "Câu hỏi tối đa 220 ký tự."),
  image: media.default(""),
  answerImage: media.optional(),
  seconds: z
    .number()
    .int()
    .min(15, "Thời gian tối thiểu 15 giây.")
    .max(600, "Thời gian tối đa 600 giây."),
  points: z
    .number()
    .int()
    .min(1, "Điểm tối thiểu là 1.")
    .max(1000, "Điểm tối đa là 1000."),
  explanation: z.string().trim().max(2000).default(""),
  tags: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
  hints: z.array(hintSchema).max(8).default([]),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  hopeStar: z.boolean().optional(),
};
export const bounds = z
  .object({
    west: z.number().min(-180).max(180),
    south: z.number().min(-90).max(90),
    east: z.number().min(-180).max(180),
    north: z.number().min(-90).max(90),
  })
  .refine(
    (b) => b.west < b.east && b.south < b.north,
    "Kiểm tra phạm vi tọa độ ảnh.",
  );
export const target = z.object({
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
});
