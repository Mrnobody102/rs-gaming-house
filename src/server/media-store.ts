import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
export async function storeImage(file: File) {
  if (!file.size || file.size > 8 * 1024 * 1024)
    throw Error("Ảnh tối đa 8 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? "png"
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? "jpg"
      : bytes.subarray(0, 4).toString() === "RIFF" &&
          bytes.subarray(8, 12).toString() === "WEBP"
        ? "webp"
        : "";
  if (!ext) throw Error("Chọn ảnh PNG, JPG hoặc WebP.");
  const mime = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" }[ext];
  const name = randomUUID();
  if (process.env.MEDIA_STORAGE === "cloudinary") {
    const cloud = process.env.CLOUDINARY_CLOUD_NAME,
      key = process.env.CLOUDINARY_API_KEY,
      secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloud || !key || !secret || !/^[-\w]+$/.test(cloud))
      throw Error("Chưa cấu hình Cloudinary.");
    const form = new FormData();
    form.set("file", new Blob([bytes], { type: mime }), `${name}.${ext}`);
    form.set("folder", "earthplay");
    form.set("public_id", name);
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
        },
        body: form,
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok) throw Error("Không tải được ảnh lên Cloudinary.");
    const result = await response.json();
    if (
      typeof result.secure_url !== "string" ||
      !result.secure_url.startsWith("https://")
    )
      throw Error("Cloudinary chưa trả về link ảnh.");
    return result.secure_url as string;
  }
  const dir = path.resolve(
    process.env.MEDIA_DIR || process.env.DEMO_MEDIA_DIR || ".local/media",
  );
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${name}.${ext}`), bytes);
  return `/api/media/${name}.${ext}`;
}
