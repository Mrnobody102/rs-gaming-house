import sharp from "sharp";
import { mkdir } from "node:fs/promises";
const input = ".local/workshop-import";
const output = "public/workshop";
await mkdir(output, { recursive: true });
for (const number of [1, 8, 11, 17]) {
  const name = `slide-${String(number).padStart(2, "0")}`;
  await sharp(`${input}/${name}.svg`)
    .webp({ quality: 93 })
    .toFile(`${output}/${name}.webp`);
}
for (const number of [2, 3, 4, 5, 6, 7, 9, 10, 12, 17, 18, 19]) {
  await sharp(`${input}/image${number}.png`)
    .resize({ width: 1800, withoutEnlargement: true })
    .webp({ quality: 93 })
    .toFile(`${output}/image-${number}.webp`);
}
// The extractor preserves slide 13's crop, rotation, picture sizes and spacing.
await sharp(`${input}/field-notes.svg`)
  .webp({ quality: 94 })
  .toFile(`${output}/field-notes.webp`);
