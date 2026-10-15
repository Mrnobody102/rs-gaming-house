import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { NextRequest } from "next/server";
import { readAdminSettings, checkStoredPasscode } from "./admin-settings";
export const ADMIN_COOKIE = "earthplay_admin";
export function adminPasscode() {
  return (
    process.env.ADMIN_PASSCODE ||
    readAdminSettings()?.hash ||
    (process.env.LOCAL_PREVIEW === "1" ? "earthplay" : "")
  );
}
const equal = (a: string, b: string) =>
  timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
export function matchesPasscode(value: string) {
  if (!process.env.ADMIN_PASSCODE) {
    const stored = readAdminSettings();
    if (stored) return checkStoredPasscode(value, stored);
  }
  const expected = adminPasscode();
  return Boolean(expected) && equal(value, expected);
}
function signature(payload: string) {
  return createHmac(
    "sha256",
    process.env.ADMIN_SESSION_SECRET ||
      readAdminSettings()?.secret ||
      `earthplay-admin:${adminPasscode()}`,
  )
    .update(adminPasscode())
    .update(":")
    .update(payload)
    .digest("base64url");
}
export function createAdminSession(now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({
      expires: now + 8 * 3600000,
      nonce: randomBytes(16).toString("hex"),
    }),
  ).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
export function validAdminSession(token: string, now = Date.now()) {
  if (!adminPasscode() || token.length > 600) return false;
  const [payload, sig, ...rest] = token.split(".");
  if (!payload || !sig || rest.length || !equal(sig, signature(payload)))
    return false;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof value.expires === "number" && value.expires > now;
  } catch {
    return false;
  }
}
export function isAdmin(request: NextRequest) {
  return validAdminSession(request.cookies.get(ADMIN_COOKIE)?.value || "");
}
