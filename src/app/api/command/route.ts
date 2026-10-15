import { NextRequest, NextResponse } from "next/server";
import { commands, type Command } from "@/server/commands";
import { execute } from "@/server/database";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    if (Number(request.headers.get("content-length")) > 40000)
      return NextResponse.json({ error: "Dữ liệu quá lớn." }, { status: 413 });
    const input = await request.json();
    if (
      !input ||
      typeof input.command !== "string" ||
      !Object.hasOwn(commands, input.command)
    )
      return NextResponse.json(
        { error: "Thao tác không hợp lệ." },
        { status: 400 },
      );
    const name = input.command as Command;
    const parsed = commands[name].safeParse(input.args || {});
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (name === "buzz_submit" && issue.path[0] === "p_buzz_id")
        return NextResponse.json(
          {
            error:
              "Màn chơi chưa cập nhật mã lượt chuông. Tải lại trang rồi bấm BUZZ.",
            code: "BUZZ_CLIENT_OUTDATED",
          },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      return NextResponse.json(
        {
          error: /[À-ỹ]/u.test(issue.message)
            ? issue.message
            : "Dữ liệu chưa hợp lệ. Tải lại trang rồi thử lại.",
        },
        { status: 400 },
      );
    }
    const data = await execute(name, parsed.data, request);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (cause) {
    const error = cause as Error & { code?: string };
    const denied = error.code === "42501";
    const message = error.message?.match(/[À-ỹ]/u)
      ? error.message
      : "Không thực hiện được. Hãy thử lại.";
    return NextResponse.json(
      {
        error: message,
        code: error.code === "P0002" ? "ROOM_NOT_FOUND" : undefined,
      },
      {
        status: denied ? 403 : error.code === "P0002" ? 404 : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
