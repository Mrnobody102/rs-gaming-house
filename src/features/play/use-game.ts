"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { command } from "@/shared/client/api";
import type { GameView } from "@/features/sessions/model";
import { acceptSnapshot } from "./state";
export function useGame(id: string, token: string) {
  const [game, setGame] = useState<GameView | null>(null),
    [error, setError] = useState(""),
    [online, setOnline] = useState(true),
    [offset, setOffset] = useState(0);
  const alive = useRef(true);
  const receive = useCallback((next: GameView) => {
    if (!alive.current) return;
    setGame((old) => acceptSnapshot(old, next));
    setOffset(Date.parse(next.serverTime) - Date.now());
    setOnline(true);
    setError("");
  }, []);
  useEffect(() => {
    alive.current = true;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let pending = false;
    async function refresh() {
      if (pending || abort.signal.aborted) return;
      pending = true;
      clearTimeout(timer);
      try {
        receive(
          await command<GameView>(
            "session_view",
            { p_id: id, p_token: token },
            abort.signal,
          ),
        );
      } catch (e) {
        if (!abort.signal.aborted) {
          setOnline(false);
          setError((e as Error).message);
        }
      } finally {
        pending = false;
        if (!abort.signal.aborted)
          timer = setTimeout(refresh, document.hidden ? 4000 : 1200);
      }
    }
    refresh();
    const wake = () => {
      if (!document.hidden) refresh();
    };
    const offline = () => setOnline(false);
    window.addEventListener("online", wake);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", wake);
    return () => {
      alive.current = false;
      abort.abort();
      clearTimeout(timer);
      window.removeEventListener("online", wake);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [id, token, receive]);
  return { game, receive, error, online, offset };
}
