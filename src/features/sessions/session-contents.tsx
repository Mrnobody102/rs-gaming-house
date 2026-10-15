"use client";
import { useState } from "react";
import Link from "next/link";
import { Pencil, Star } from "lucide-react";
import { command } from "@/shared/client/api";
import { ErrorMessage, Loading } from "@/shared/ui/status";
import type { SessionPlan } from "./model";

export function SessionContents({ id, total }: { id: string; total: number }) {
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [error, setError] = useState("");
  return (
    <div className="session-contents">
      <div>
        <strong>Nội dung phiên · {total} câu</strong>
        <Link className="text-link" href={`/admin/sessions/${id}/edit/`}>
          <Pencil size={14} /> Chỉnh sửa phiên
        </Link>
      </div>
      <details
        onToggle={(e) => {
          if (e.currentTarget.open && !plan)
            command<SessionPlan>("session_plan", { p_id: id })
              .then(setPlan)
              .catch((e) => setError(e.message));
        }}
      >
        <summary>Xem danh sách câu hỏi</summary>
        <ErrorMessage message={error} />
        {!plan && !error ? (
          <Loading />
        ) : (
          <ol>
            {plan?.questions.map((q) => (
              <li key={q.id}>
                <span>{q.title}</span>
                <small>{q.points} điểm</small>
                {q.hopeStar && (
                  <Star aria-label="Cho phép ngôi sao" size={15} />
                )}
              </li>
            ))}
            {Boolean(plan?.reserveQuestionIds?.length) && (
              <li>
                <span>Câu dự bị: {plan!.reserveQuestionIds.length}</span>
              </li>
            )}
          </ol>
        )}
      </details>
    </div>
  );
}
