import { NextRequest } from "next/server";
import { z } from "zod";
import { execute } from "@/server/database";
import { subscribeGame } from "@/server/game-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const parsed = z
    .object({ id: z.uuid(), token: z.string().max(200) })
    .safeParse({
      id: request.nextUrl.searchParams.get("id"),
      token: request.nextUrl.searchParams.get("token") || "",
    });
  if (!parsed.success) return new Response(null, { status: 400 });
  const { id, token } = parsed.data;
  try {
    // Same access rules as a game snapshot; events contain only invalidations.
    await execute("session_view", { p_id: id, p_token: token }, request);
  } catch {
    return new Response(null, { status: 403 });
  }
  let cleanup = () => {};
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval>;
      let unsubscribe = () => {};
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        request.signal.removeEventListener("abort", close);
        try {
          controller.close();
        } catch {
          /* Already cancelled by the reader. */
        }
      };
      cleanup = close;
      const send = (data: string) => {
        if (closed) return;
        if (controller.desiredSize !== null && controller.desiredSize < 0) {
          close();
          return;
        }
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          close();
        }
      };
      unsubscribe = subscribeGame(id, (revision) =>
        send(`event: change\ndata: ${revision}\n\n`),
      );
      heartbeat = setInterval(() => send(": heartbeat\n\n"), 15000);
      request.signal.addEventListener("abort", close, { once: true });
      if (request.signal.aborted) close();
      else send("event: change\ndata: ready\n\n");
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "private, no-cache, no-store, no-transform",
      "X-Accel-Buffering": "no",
      "Referrer-Policy": "no-referrer",
    },
  });
}
