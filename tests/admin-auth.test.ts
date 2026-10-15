import { afterEach, expect, it, vi } from "vitest";
import {
  createAdminSession,
  matchesPasscode,
  validAdminSession,
} from "../src/server/admin-auth";
afterEach(() => vi.unstubAllEnvs());
it("requires the configured passcode and rejects tampered and expired admin cookies", () => {
  vi.stubEnv("ADMIN_PASSCODE", "test-secret-only");
  expect(matchesPasscode("wrong")).toBe(false);
  expect(matchesPasscode("test-secret-only")).toBe(true);
  const token = createAdminSession(1000);
  expect(validAdminSession(token, 1001)).toBe(true);
  expect(validAdminSession(token + "x", 1001)).toBe(false);
  expect(validAdminSession(token, 1000 + 8 * 3600000)).toBe(false);
  vi.stubEnv("ADMIN_PASSCODE", "changed-secret");
  expect(validAdminSession(token, 1001)).toBe(false);
});
