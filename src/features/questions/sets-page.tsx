"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Layers, Trash2, ArrowUpRight, Play, Star } from "lucide-react";
import { command } from "@/shared/client/api";
import { Loading, ErrorMessage } from "@/shared/ui/status";
export type QuestionSet = {
  id: string;
  title: string;
  questionIds: string[];
  starQuestionIds?: string[];
  reserveQuestionIds?: string[];
};
export function SetsPage() {
  const [sets, setSets] = useState<QuestionSet[] | null>(null),
    [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  useEffect(() => {
    command<QuestionSet[]>("set_list")
      .then(setSets)
      .catch((e) => setError(e.message));
  }, []);
  async function archive(s: QuestionSet) {
    if (
      deleting ||
      !confirm(
        `Xóa bộ câu hỏi “${s.title}”? Câu hỏi trong kho và các phòng đã tạo vẫn được giữ.`,
      )
    )
      return;
    setDeleting(s.id);
    setError("");
    try {
      await command("set_archive", { p_id: s.id });
      setSets((list) => list?.filter((v) => v.id !== s.id) || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(null);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CHUẨN BỊ</p>
          <h1>Bộ câu hỏi</h1>
        </div>
        <Link className="button primary" href="/admin/sets/new/">
          <Plus size={18} />
          <span>Tạo bộ câu hỏi</span>
        </Link>
      </div>
      <ErrorMessage message={error} />
      {!sets && !error ? (
        <Loading />
      ) : sets?.length ? (
        <div className="session-list">
          {sets.map((s) => (
            <article className="session-row" key={s.id}>
              <Layers size={25} />
              <Link className="session-name" href={`/admin/sets/${s.id}/`}>
                <h2>{s.title}</h2>
                <p>
                  {s.questionIds.length} câu
                  {Boolean(s.reserveQuestionIds?.length) &&
                    ` · ${s.reserveQuestionIds!.length} dự bị`}
                  {Boolean(s.starQuestionIds?.length) && (
                    <>
                      {" "}
                      · <Star size={12} /> {s.starQuestionIds!.length} câu ngôi
                      sao
                    </>
                  )}
                </p>
              </Link>
              <Link
                className="button secondary small"
                href={`/admin/questions/new/?set=${s.id}`}
              >
                <Plus size={15} />
                <span>Soạn câu</span>
              </Link>
              <Link
                className="button secondary small"
                href={`/admin/present/${s.id}/?source=set`}
              >
                Trình chiếu
              </Link>
              <Link
                className="button secondary small"
                href={
                  s.questionIds.length
                    ? `/admin/sessions/new/?set=${s.id}`
                    : `/admin/sets/${s.id}/`
                }
              >
                <Play size={15} />
                <span>
                  {s.questionIds.length ? "Tạo phòng" : "Thêm câu hỏi"}
                </span>
              </Link>
              <button
                className="icon-button"
                aria-label={`Xóa bộ câu hỏi ${s.title}`}
                disabled={deleting !== null}
                onClick={() => archive(s)}
              >
                <Trash2 size={17} />
              </button>
              <Link
                href={`/admin/sets/${s.id}/`}
                className="icon-button"
                aria-label={`Sửa ${s.title}`}
              >
                <ArrowUpRight size={19} />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-panel">
          <Layers size={32} />
          <h2>Chưa có bộ câu hỏi</h2>
          <Link href="/admin/sets/new/" className="button secondary">
            Tạo bộ câu hỏi
          </Link>
        </div>
      )}
    </>
  );
}
