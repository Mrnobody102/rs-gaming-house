import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminPasscode,
  createAdminSession,
  isAdmin,
  matchesPasscode,
} from "@/server/admin-auth";
export const runtime = "nodejs";
const attempts = new Map<string, { count: number; reset: number }>();
export function GET(request: NextRequest) {
  return NextResponse.json(
    { authenticated: isAdmin(request), configured: Boolean(adminPasscode()) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: NextRequest) {
  if (!adminPasscode())
    return NextResponse.json(
      { error: "Chưa đặt mật mã quản trị." },
      { status: 503 },
    );
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host"))
    return NextResponse.json(
      { error: "Yêu cầu không hợp lệ." },
      { status: 403 },
    );
  const address =
    request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const now = Date.now();
  for (const [key, value] of attempts)
    if (value.reset <= now) attempts.delete(key);
  const entry = attempts.get(address) || { count: 0, reset: now + 60000 };
  if (entry.count >= 8)
    return NextResponse.json(
      { error: "Thử lại sau một phút." },
      { status: 429 },
    );
  let value: unknown;
  try {
    value = (await request.json()).passcode;
  } catch {}
  if (
    typeof value !== "string" ||
    value.length > 256 ||
    !matchesPasscode(value)
  ) {
    entry.count++;
    attempts.set(address, entry);
    return NextResponse.json({ error: "Mật mã chưa đúng." }, { status: 401 });
  }
  attempts.delete(address);
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(ADMIN_COOKIE, createAdminSession(), {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 3600,
    secure: request.nextUrl.protocol === "https:",
  });
  return response;
}
export function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.delete(ADMIN_COOKIE);
  return response;
}
