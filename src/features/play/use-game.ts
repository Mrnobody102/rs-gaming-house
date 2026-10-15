"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { command, CommandError } from "@/shared/client/api";
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
    let dirty = false;
    let streaming = false;
    async function refresh() {
      if (abort.signal.aborted) return;
      if (pending) {
        dirty = true;
        return;
      }
      dirty = false;
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
          if (e instanceof CommandError && e.code === "ROOM_NOT_FOUND") {
            setGame(null);
            events.close();
            abort.abort();
          }
        }
      } finally {
        pending = false;
        if (!abort.signal.aborted)
          timer = setTimeout(
            refresh,
            dirty ? 0 : document.hidden ? 15000 : streaming ? 6000 : 1200,
          );
      }
    }
    refresh();
    const events = new EventSource(
      `/api/events/?${new URLSearchParams({ id, token })}`,
    );
    events.onopen = () => {
      streaming = true;
    };
    events.addEventListener("change", () => {
      void refresh();
    });
    events.onerror = () => {
      streaming = false;
      void refresh();
    };
    const wake = () => {
      if (!document.hidden) refresh();
    };
    const offline = () => setOnline(false);
    window.addEventListener("online", wake);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", wake);
    return () => {
      alive.current = false;
      events.close();
      abort.abort();
      clearTimeout(timer);
      window.removeEventListener("online", wake);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [id, token, receive]);
  return { game, receive, error, online, offset };
}
