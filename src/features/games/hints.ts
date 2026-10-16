import { z } from "zod";
import { media } from "./schemas/media";

const textHint = z.object({
  type: z.literal("text"),
  text: z.string().trim().min(1).max(220),
});
const imageHint = z.object({
  type: z.literal("image"),
  image: media.refine(Boolean, "Chọn ảnh gợi ý."),
});
// Existing questions can keep their plain text hints.
export const hintSchema = z.union([
  z.string().trim().min(1).max(220),
  z.discriminatedUnion("type", [textHint, imageHint]),
]);
export type Hint = z.infer<typeof hintSchema>;
export function usesProgressiveHints(q: {
  kind: string;
  image: string;
  hintMode?: string;
}) {
  return (
    !!q.image &&
    q.hintMode === "progressive" &&
    (q.kind === "place" || q.kind === "riddle")
  );
}
export function readHint(hint: Hint) {
  return typeof hint === "string"
    ? { type: "text" as const, text: hint }
    : hint;
}
export function hintSlots(hints: Hint[] = []): Hint[] {
  return [
    ...hints,
    ...Array.from({ length: Math.max(0, 3 - hints.length) }, () => ""),
  ];
}
export function cleanHints(hints: Hint[]): Hint[] {
  return hints
    .map((hint) =>
      typeof hint === "string"
        ? hint.trim()
        : hint.type === "text"
          ? { ...hint, text: hint.text.trim() }
          : { ...hint, image: hint.image.trim() },
    )
    .filter((hint) =>
      typeof hint === "string"
        ? Boolean(hint)
        : hint.type === "text"
          ? Boolean(hint.text)
          : Boolean(hint.image),
    );
}
