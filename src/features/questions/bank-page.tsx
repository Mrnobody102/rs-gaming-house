"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  ImageIcon,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Layers,
} from "lucide-react";
import { command } from "@/shared/client/api";
import { ErrorMessage, Loading } from "@/shared/ui/status";
import { kindLabels, type Question } from "./model";
import { difficultyLabels, difficultyOf } from "./difficulty";
import { filterQuestions } from "./filter";
import { pointsForDifficulty } from "@/features/games/scoring";

export function BankPage({
  game = "all",
}: {
  game?: Question["kind"] | "all";
}) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState("");
  const [archiving, setArchiving] = useState<string | null>(null);
  useEffect(() => {
    command<Question[]>("bank_list")
      .then(setQuestions)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => setPage(0), [query, game, difficulty, pageSize]);
  async function archive(q: Question) {
    if (
      !confirm(
        `Xóa câu “${q.title}” khỏi kho và các bộ đang dùng? Các phòng đã tạo vẫn giữ câu hỏi này.`,
      )
    )
      return;
    setArchiving(q.id);
    setError("");
    try {
      await command("bank_archive", { p_id: q.id });
      setQuestions((list) => list?.filter((x) => x.id !== q.id) || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setArchiving(null);
    }
  }
  if (!questions && !error) return <Loading />;
  const list = filterQuestions(questions || [], {
    query,
    kind: game,
    difficulty,
  });
  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const firstPage = Math.max(0, Math.min(current - 2, pageCount - 5));
  return (
    <>
      <div className="page-heading">
        <h1>
          Câu hỏi <span className="count">{questions?.length || 0}</span>
        </h1>
        <div className="heading-actions">
          <Link className="button secondary" href="/admin/sets/">
            <Layers size={17} />
            <span>Bộ câu hỏi</span>
          </Link>
          <Link
            className="button primary"
            href={`/admin/questions/new/?game=${game === "all" ? "riddle" : game}`}
          >
            <Plus size={18} />
            <span>Soạn câu hỏi</span>
          </Link>
        </div>
      </div>
      <ErrorMessage message={error} />
      <div className="question-library">
        <nav className="library-games" aria-label="Câu hỏi theo game">
          <p className="eyebrow">GAME</p>
          <Link
            href="/admin/questions/"
            aria-current={game === "all" ? "page" : undefined}
          >
            <span>
              <Layers size={16} /> Tất cả
            </span>
            <b>{questions?.length || 0}</b>
          </Link>
          {Object.entries(kindLabels).map(([key, label]) => (
            <Link
              key={key}
              href={`/admin/questions/?game=${key}`}
              aria-current={game === key ? "page" : undefined}
            >
              <span>{label}</span>
              <b>{questions?.filter((q) => q.kind === key).length || 0}</b>
            </Link>
          ))}
        </nav>
        <section className="library-main" aria-label="Danh sách câu hỏi">
          <div className="library-toolbar">
            <h2>
              {game === "all" ? "Tất cả game" : kindLabels[game]}{" "}
              <span>{list.length} câu</span>
            </h2>
            <div className="library-filters">
              <label className="search-field">
                <Search size={17} />
                <input
                  aria-label="Tìm câu hỏi"
                  placeholder="Tìm câu hỏi…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <select
                aria-label="Lọc độ khó"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="all">Mọi độ khó</option>
                {Object.entries(difficultyLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="question-table-scroll">
            <table className="question-table">
              <thead>
                <tr>
                  <th scope="col">Câu hỏi</th>
                  <th scope="col">Độ khó</th>
                  <th scope="col">Điểm</th>
                  <th scope="col">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list
                  .slice(current * pageSize, (current + 1) * pageSize)
                  .map((q) => (
                    <tr key={q.id} className="question-row">
                      <td>
                        <Link
                          href={`/admin/questions/${q.id}/`}
                          className="question-row-link"
                        >
                          <span className="question-row-image">
                            {q.image ? (
                              <img src={q.image} alt="" loading="lazy" />
                            ) : (
                              <ImageIcon size={21} />
                            )}
                          </span>
                          <span className="question-row-text">
                            <strong>{q.title}</strong>
                            <small>
                              {game === "all"
                                ? kindLabels[q.kind]
                                : `${q.hints?.length || 0} gợi ý`}
                              {q.tags.length > 0 && ` · ${q.tags.join(", ")}`}
                            </small>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <span
                          className={`difficulty difficulty-${difficultyOf(q)}`}
                        >
                          {difficultyLabels[difficultyOf(q)]}
                        </span>
                      </td>
                      <td className="question-row-points">
                        {pointsForDifficulty(q.difficulty)}
                      </td>
                      <td>
                        <div className="question-row-actions">
                          <Link
                            className="icon-button"
                            aria-label={`Sửa ${q.title}`}
                            href={`/admin/questions/${q.id}/`}
                          >
                            <Pencil size={16} />
                          </Link>
                          <button
                            type="button"
                            className="icon-button"
                            disabled={archiving === q.id}
                            aria-label={`Xóa câu hỏi ${q.title}`}
                            onClick={() => archive(q)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!list.length && (
            <div className="library-empty">
              <ImageIcon size={28} />
              <h3>
                {query || difficulty !== "all"
                  ? "Không tìm thấy câu hỏi"
                  : "Game này chưa có câu hỏi"}
              </h3>
              {query || difficulty !== "all" ? (
                <button
                  className="text-link"
                  onClick={() => {
                    setQuery("");
                    setDifficulty("all");
                  }}
                >
                  Xóa bộ lọc
                </button>
              ) : (
                <Link
                  className="text-link"
                  href={`/admin/questions/new/?game=${game === "all" ? "riddle" : game}`}
                >
                  Soạn câu đầu tiên
                </Link>
              )}
            </div>
          )}
          <div className="question-pagination">
            <div className="pagination-info">
              <span>
                {list.length ? current * pageSize + 1 : 0}–
                {Math.min((current + 1) * pageSize, list.length)} /{" "}
                {list.length} câu
              </span>
              <select
                aria-label="Số câu mỗi trang"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} / trang
                  </option>
                ))}
              </select>
            </div>
            <nav aria-label="Phân trang câu hỏi">
              <button
                type="button"
                aria-label="Trang trước"
                className="icon-button"
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              {Array.from(
                { length: Math.min(5, pageCount) },
                (_, i) => firstPage + i,
              ).map((i) => (
                <button
                  key={i}
                  type="button"
                  className="page-number"
                  aria-label={`Trang ${i + 1}`}
                  aria-current={current === i ? "page" : undefined}
                  onClick={() => setPage(i)}
                >
                  {i + 1}
                </button>
              ))}
              <button
                type="button"
                aria-label="Trang sau"
                className="icon-button"
                disabled={current === pageCount - 1}
                onClick={() => setPage(current + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </nav>
          </div>
        </section>
      </div>
    </>
  );
}
