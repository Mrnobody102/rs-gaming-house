import { configuration } from "@/server/config";
import { networkInterfaces } from "node:os";
import { lanAddress } from "@/server/network";
export function GET(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.host;
  const ip = lanAddress(networkInterfaces());
  const joinBaseUrl =
    process.env.JOIN_BASE_URL ||
    `${url.protocol}//${/^(localhost|127\.0\.0\.1)(:|$)/.test(host) && ip ? ip + (url.port ? `:${url.port}` : "") : host}`;
  return Response.json(
    { ...configuration(), joinBaseUrl },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
