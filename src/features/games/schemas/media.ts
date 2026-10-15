import { z } from "zod";
export const media = z
  .string()
  .max(2000)
  .refine(
    (value) => !value || /^https:\/\//.test(value) || /^\/(?!\/)/.test(value),
    "Chọn ảnh đã tải lên hoặc URL HTTPS.",
  );
