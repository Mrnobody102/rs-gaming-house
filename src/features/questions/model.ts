import { z } from "zod";
export { questionSchema } from "../games/question-schema";
export type {
  Question,
  PublicQuestion,
  Answer,
  Coordinate,
  Region,
} from "../games/question-schema";
export { kindLabels, newQuestion } from "../games/catalog";
export const sessionInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Nhập tên ít nhất 2 ký tự.")
    .max(100, "Tên tối đa 100 ký tự."),
  questionIds: z
    .array(z.uuid())
    .min(1, "Chọn ít nhất một câu hỏi.")
    .max(50)
    .refine((ids) => new Set(ids).size === ids.length, "Câu hỏi bị trùng."),
  capacity: z.number().int().min(2).max(60, "Tối đa 60 người."),
  starQuestionIds: z.array(z.uuid()).max(50).optional(),
  setId: z.uuid().optional(),
  reserveQuestionIds: z.array(z.uuid()).max(10).optional(),
});
export type SessionInput = z.infer<typeof sessionInputSchema>;
