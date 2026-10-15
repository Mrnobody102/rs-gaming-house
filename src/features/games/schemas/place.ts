import { z } from "zod";
import { common, media } from "./common";
export const placeSchema = z.object({
  ...common,
  kind: z.literal("place"),
  image: media.refine(Boolean, "Chọn ảnh địa danh."),
  solution: z.string().trim().min(1, "Nhập địa danh đúng.").max(160),
});
