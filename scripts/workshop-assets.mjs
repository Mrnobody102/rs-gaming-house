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
// Rotate the notebook into reading orientation and retain all three labelled photos.
const parts = [
  {
    input: await sharp(`${input}/image16.png`)
      .rotate(270)
      .resize(960, 720, { fit: "contain", background: "#14251d" })
      .toBuffer(),
    left: 420,
    top: 0,
  },
];
for (let i = 0; i < 3; i++) {
  parts.push({
    input: await sharp(`${input}/image${13 + i}.jpeg`)
      .resize(580, 420, { fit: "contain", background: "#14251d" })
      .toBuffer(),
    left: i * 600 + 10,
    top: 760,
  });
  parts.push({
    input: Buffer.from(
      `<svg width="580" height="40"><text x="290" y="30" text-anchor="middle" font-family="Arial" font-size="32" fill="white">${"ABC"[i]}</text></svg>`,
    ),
    left: i * 600 + 10,
    top: 1190,
  });
}
await sharp({
  create: { width: 1800, height: 1240, channels: 3, background: "#14251d" },
})
  .composite(parts)
  .webp({ quality: 94 })
  .toFile(`${output}/field-notes.webp`);
