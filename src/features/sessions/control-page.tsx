"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Monitor } from "lucide-react";
import { GameScreen } from "@/features/play/game-screen";
import { command, getConfig } from "@/shared/client/api";
import type { SessionSummary } from "./model";
export function ControlPage({ id }: { id: string }) {
  const [session, setSession] = useState<SessionSummary | null>(null),
    [base, setBase] = useState("");
  useEffect(() => {
    command<SessionSummary[]>("session_list").then((list) =>
      setSession(list.find((s) => s.id === id) || null),
    );
    getConfig()
      .then((c) => setBase(c.joinBaseUrl || location.origin))
      .catch(() => setBase(location.origin));
  }, [id]);
  return (
    <>
      <div className="control-heading">
        <Link className="back-link" href="/admin/sessions/">
          <ArrowLeft size={16} /> Phiên chơi
        </Link>
        <div>
          {session && (
            <Link
              className="button secondary"
              target="_blank"
              href={`/screen/${id}/?view=${session.view_token}`}
            >
              <Monitor size={16} /> Mở trình chiếu
            </Link>
          )}
        </div>
      </div>
      <div className="host-frame">
        <GameScreen id={id} host joinBase={base} />
      </div>
    </>
  );
}
