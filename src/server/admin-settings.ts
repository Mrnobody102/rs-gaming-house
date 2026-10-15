import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import path from "node:path";
type Settings = { salt: string; hash: string; secret: string };
function filename() {
  return path.join(
    path.resolve(
      process.env.ADMIN_SETTINGS_DIR ||
        `${process.env.APP_DATA_DIR || process.env.DEMO_DATA_DIR || ".local/postgres"}-settings`,
    ),
    "admin.json",
  );
}
export function readAdminSettings(): Settings | null {
  try {
    const value = JSON.parse(readFileSync(filename(), "utf8"));
    return typeof value.salt === "string" &&
      typeof value.hash === "string" &&
      typeof value.secret === "string"
      ? value
      : null;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
export function saveAdminSettings(passcode: string) {
  const file = filename();
  mkdirSync(path.dirname(file), { recursive: true });
  const salt = randomBytes(16).toString("hex"),
    hash = scryptSync(passcode, salt, 32).toString("hex");
  writeFileSync(
    file,
    JSON.stringify({ salt, hash, secret: randomBytes(32).toString("hex") }),
    { flag: "wx", mode: 0o600 },
  );
}
export function checkStoredPasscode(passcode: string, settings: Settings) {
  const hash = Buffer.from(settings.hash, "hex"),
    actual = scryptSync(passcode, settings.salt, 32);
  return hash.length === actual.length && timingSafeEqual(hash, actual);
}
