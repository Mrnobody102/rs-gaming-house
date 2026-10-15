import { NextRequest } from "next/server";
import QRCode from "qrcode";
export async function GET(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("url") || "";
  if (value.length > 2000 || !/^https?:\/\//.test(value))
    return new Response(null, { status: 400 });
  return new Response(
    await QRCode.toString(value, {
      type: "svg",
      margin: 2,
      errorCorrectionLevel: "M",
    }),
    {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
