import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminPasscode,
  createAdminSession,
} from "@/server/admin-auth";
import { saveAdminSettings } from "@/server/admin-settings";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (adminPasscode())
    return NextResponse.json(
      { error: "Mật mã đã được đặt. Hãy đăng nhập." },
      { status: 409 },
    );
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host"))
    return NextResponse.json(
      { error: "Yêu cầu không hợp lệ." },
      { status: 403 },
    );
  try {
    const { passcode, confirmation } = await request.json();
    if (
      typeof passcode !== "string" ||
      passcode.length < 8 ||
      passcode.length > 128
    )
      return NextResponse.json(
        { error: "Mật mã cần từ 8 đến 128 ký tự." },
        { status: 400 },
      );
    if (passcode !== confirmation)
      return NextResponse.json(
        { error: "Hai mật mã chưa khớp." },
        { status: 400 },
      );
    saveAdminSettings(passcode);
    const response = NextResponse.json({ authenticated: true });
    response.cookies.set(ADMIN_COOKIE, createAdminSession(), {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 8 * 3600,
      secure: request.nextUrl.protocol === "https:",
    });
    return response;
  } catch (e) {
    const conflict = (e as NodeJS.ErrnoException).code === "EEXIST";
    return NextResponse.json(
      {
        error: conflict
          ? "Mật mã đã được đặt. Hãy tải lại để đăng nhập."
          : "Chưa lưu được mật mã. Hãy thử lại.",
      },
      { status: conflict ? 409 : 500 },
    );
  }
}
