"use client";
import Link from "next/link";
import { usesBuzz } from "@/features/games/catalog";
import type { Question } from "./model";

export function ReserveFields({
  bank,
  mainIds,
  ids,
  onChange,
}: {
  bank: Question[];
  mainIds: string[];
  ids: string[];
  onChange: (ids: string[]) => void;
}) {
  const choices = bank.filter((q) => !mainIds.includes(q.id) && usesBuzz(q));
  return (
    <details className="panel reserve-fields">
      <summary>
        Câu dự bị <span className="count">{ids.length}</span>
      </summary>
      <p>
        Chỉ dùng để phân hạng đồng điểm · BUZZ, không cộng điểm, không dùng sao.
      </p>
      <div className="reserve-choices">
        {ids
          .filter((id) => !bank.some((q) => q.id === id))
          .map((id) => (
            <label key={id}>
              <input
                type="checkbox"
                checked
                aria-label="Câu dự bị đã lưu trữ"
                onChange={() => onChange(ids.filter((value) => value !== id))}
              />
              <span>Câu dự bị đã lưu trữ · bỏ chọn để loại khỏi bộ</span>
            </label>
          ))}
        {choices.map((q) => (
          <label key={q.id}>
            <input
              type="checkbox"
              aria-label={`Dự bị: ${q.title}`}
              checked={ids.includes(q.id)}
              disabled={!ids.includes(q.id) && ids.length >= 10}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...ids, q.id]
                    : ids.filter((id) => id !== q.id),
                )
              }
            />
            <span>{q.title}</span>
          </label>
        ))}
      </div>
      {!choices.length && (
        <Link className="text-link" href="/admin/questions/">
          Soạn thêm câu hỏi dùng BUZZ
        </Link>
      )}
    </details>
  );
}
