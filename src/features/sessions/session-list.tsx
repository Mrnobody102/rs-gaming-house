"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, ArrowUpRight } from "lucide-react";
import { command } from "@/shared/client/api";
import { ErrorMessage, Loading, phaseLabels } from "@/shared/ui/status";
import type { SessionSummary } from "./model";
import { DeleteSessionButton } from "./delete-session-button";
export function SessionList() {
  const [list, setList] = useState<SessionSummary[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    command<SessionSummary[]>("session_list")
      .then(setList)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <div className="page-heading">
        <h1>Phòng chơi</h1>
        <Link className="button primary" href="/admin/sessions/new/">
          <Plus size={18} /> Tạo phòng
        </Link>
      </div>
      <ErrorMessage message={error} />
      {!list && !error ? (
        <Loading />
      ) : list?.length ? (
        <div className="session-list">
          {list.map((s) => (
            <article className="session-row" key={s.id}>
              <Link className="session-open" href={`/admin/sessions/${s.id}/`}>
                <div className="session-code">{s.code}</div>
                <div className="session-name">
                  <h2>{s.title}</h2>
                  <p>
                    {s.total} câu · Tối đa {s.capacity} người
                  </p>
                </div>
                <span className="badge">{phaseLabels[s.phase]}</span>
                <ArrowUpRight size={20} />
              </Link>
              <DeleteSessionButton
                id={s.id}
                title={s.title}
                onError={setError}
                onDeleted={() =>
                  setList(
                    (rows) => rows?.filter((row) => row.id !== s.id) || [],
                  )
                }
              />
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-panel">
          <h2>Chưa có phiên chơi</h2>
          <Link href="/admin/sessions/new/" className="button secondary">
            Tạo phòng
          </Link>
        </div>
      )}
    </>
  );
}
