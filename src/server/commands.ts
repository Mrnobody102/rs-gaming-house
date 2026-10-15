import { z } from "zod";
import { questionSchema, sessionInputSchema } from "@/features/questions/model";
const id = z.uuid();
export const commands = {
  bank_list: z.object({}),
  bank_save: z.object({ p_question: questionSchema }),
  bank_save_to_set: z.object({ p_id: id, p_question: questionSchema }),
  bank_archive: z.object({ p_id: id }),
  set_list: z.object({}),
  set_save: z.object({
    p_id: id,
    p_title: z.string().trim().min(2).max(100),
    p_question_ids: z.array(id).max(50),
    p_star_question_ids: z.array(id).max(50).optional(),
    p_reserve_question_ids: z.array(id).max(10).optional(),
  }),
  set_add_question: z.object({ p_id: id, p_question_id: id }),
  set_archive: z.object({ p_id: id }),
  session_list: z.object({}),
  session_create: sessionInputSchema.transform((v) => ({
    p_title: v.title,
    p_question_ids: v.questionIds,
    p_capacity: v.capacity,
    p_star_question_ids: v.starQuestionIds ?? null,
    p_set_id: v.setId ?? null,
    p_reserve_question_ids: v.reserveQuestionIds || [],
  })),
  session_plan: z.object({ p_id: id }),
  session_plan_save: sessionInputSchema.extend({ id }).transform((v) => ({
    p_id: v.id,
    p_title: v.title,
    p_question_ids: v.questionIds,
    p_capacity: v.capacity,
    p_star_question_ids: v.starQuestionIds || [],
    p_reserve_question_ids: v.reserveQuestionIds || [],
  })),
  session_join: z.object({
    p_code: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9]{6}$/, "Mã phòng gồm 6 chữ hoặc số."),
    p_name: z.string().trim().min(1).max(40),
    p_token: z.string().min(32).max(200),
  }),
  session_view: z.object({
    p_id: id,
    p_token: z.string().max(200).default(""),
  }),
  answer_submit: z.object({
    p_id: id,
    p_round_id: id,
    p_token: z.string().min(32).max(200),
    p_payload: z.union([
      z.object({ choice: z.number().int().min(0).max(3) }),
      z.object({
        tiles: z.array(z.number().int().min(0).max(8)).min(4).max(9),
      }),
    ]),
  }),
  session_control: z.object({
    p_id: id,
    p_action: z.enum(["start", "reveal", "leaderboard", "next", "finish"]),
    p_round_id: id,
  }),
  buzz_submit: z.object({
    p_id: id,
    p_round_id: id,
    p_buzz_id: id,
    p_token: z.string().min(32).max(200),
  }),
  buzz_control: z.object({ p_id: id, p_round_id: id, p_open: z.boolean() }),
  tie_start: z.object({ p_id: id, p_round_id: id }),
  tie_reserve_add: z.object({ p_id: id, p_question_id: id }),
  star_select: z.object({
    p_id: id,
    p_round_id: id,
    p_token: z.string().min(32).max(200),
    p_active: z.boolean(),
  }),
  buzz_grade: z.object({
    p_id: id,
    p_round_id: id,
    p_participant_id: id,
    p_correct: z.boolean(),
  }),
  session_hint: z.object({ p_id: id, p_round_id: id }),
  session_guess: z.object({
    p_id: id,
    p_round_id: id,
    p_lng: z.number().min(-180).max(180),
    p_lat: z.number().min(-90).max(90),
  }),
};
export type Command = keyof typeof commands;
