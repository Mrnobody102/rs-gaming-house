import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/server/admin-auth";
import { storeImage } from "@/server/media-store";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!isAdmin(request))
    return NextResponse.json(
      { error: "Nhập mật mã để tải ảnh." },
      { status: 403 },
    );
  if (Number(request.headers.get("content-length")) > 8500000)
    return NextResponse.json({ error: "Ảnh tối đa 8 MB." }, { status: 413 });
  try {
    const form = await request.formData(),
      file = form.get("file");
    if (!(file instanceof File)) throw Error("Chọn ảnh để tải lên.");
    return NextResponse.json({ url: await storeImage(file) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không tải được ảnh." },
      { status: 400 },
    );
  }
}
