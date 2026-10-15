"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { command } from "@/shared/client/api";
import { ErrorMessage, Loading } from "@/shared/ui/status";
import { EarthFields } from "./earth-fields";
import { MediaField } from "./media-field";
import { HintFields } from "./hint-fields";
import { cleanHints, hintSlots } from "@/features/games/hints";
import { pointsForDifficulty } from "@/features/games/scoring";
import type { QuestionSet } from "./sets-page";
import { difficultyLabels, difficultyOf } from "./difficulty";
import {
  kindLabels,
  newQuestion,
  questionSchema,
  type Question,
} from "./model";

export function EditorPage({
  id,
  game,
  setId,
}: {
  id: string;
  game?: string;
  setId?: string;
}) {
  const [q, setQ] = useState<Question>(() =>
    newQuestion(
      game && Object.hasOwn(kindLabels, game)
        ? (game as Question["kind"])
        : "riddle",
    ),
  );
  const [loaded, setLoaded] = useState(id === "new");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [setTitle, setSetTitle] = useState("");
  const [missing, setMissing] = useState(false);
  const router = useRouter();
  const bankUrl = setId
    ? `/admin/sets/${setId}/`
    : `/admin/questions/?game=${q.kind}`;
  useEffect(() => {
    if (id === "new") return;
    let cancelled = false;
    setLoaded(false);
    setMissing(false);
    setError("");
    command<Question[]>("bank_list")
      .then((list) => {
        if (cancelled) return;
        const found = list.find((v) => v.id === id);
        if (!found) throw new Error("Không tìm thấy câu hỏi.");
        // Give older calibrated questions a readable answer in the same form.
        if (found.kind === "locate" && !found.solution && found.target)
          found.solution = `${found.target.lng.toFixed(5)}° E · ${found.target.lat.toFixed(5)}° N`;
        if (found.kind === "change" && !found.solution)
          found.solution = found.regions
            .map((r) => r.label)
            .join("; ")
            .slice(0, 220);
        setQ(found);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setMissing(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);
  useEffect(() => {
    if (!setId) return;
    let cancelled = false;
    command<QuestionSet[]>("set_list")
      .then((sets) => {
        const selected = sets.find((s) => s.id === setId);
        if (!selected)
          throw new Error("Không tìm thấy bộ câu hỏi. Hãy chọn lại bộ.");
        if (!cancelled) setSetTitle(selected.title);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setMissing(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [setId]);
  function patch(value: Partial<Question>) {
    setQ((q) => ({ ...q, ...value }) as Question);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const valid = questionSchema.safeParse({
      ...q,
      tags: q.tags.map((t) => t.trim()).filter(Boolean),
      hints: cleanHints(q.hints || []),
    });
    if (!valid.success) {
      setError(valid.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (setId)
        await command("bank_save_to_set", {
          p_id: setId,
          p_question: valid.data,
        });
      else await command("bank_save", { p_question: valid.data });
      router.push(bankUrl);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(
    file?: File,
    field: "image" | "afterImage" | ((url: string) => void) = "image",
  ) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/upload/", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (typeof field === "function") field(result.url);
      else patch({ [field]: result.url });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  if (!loaded) return <Loading />;
  if (missing)
    return (
      <div className="panel form-stack">
        <ErrorMessage message={error} />
        <Link
          className="text-link"
          href={setId ? "/admin/sets/" : "/admin/questions/"}
        >
          Về danh sách {setId ? "bộ câu hỏi" : "câu hỏi"}
        </Link>
      </div>
    );
  return (
    <form onSubmit={save} className="question-editor">
      <div className="page-heading">
        <div>
          <Link href={bankUrl} className="back-link">
            <ArrowLeft size={15} />{" "}
            {setId ? "Về bộ câu hỏi" : kindLabels[q.kind]}
          </Link>
          <h1>{id === "new" ? "Soạn câu hỏi" : "Sửa câu hỏi"}</h1>
        </div>
        <div className="heading-actions">
          <Link href="/admin/sets/" className="button secondary">
            <span>Bộ câu hỏi</span>
          </Link>
          <button
            className="button primary"
            disabled={busy || uploading || Boolean(setId && !setTitle)}
          >
            <Check size={18} />
            <span>{busy ? "Đang lưu…" : "Lưu câu hỏi"}</span>
          </button>
        </div>
      </div>
      {setId && (
        <p className="editor-set-context">
          Đang soạn cho bộ:{" "}
          <Link href={bankUrl}>{setTitle || "Đang tải…"}</Link>
        </p>
      )}
      <ErrorMessage message={error} />
      <div className="panel question-editor-panel">
        <div className="field-pair editor-classification">
          <label>
            Game
            <select
              value={q.kind}
              onChange={(e) => {
                const next = newQuestion(e.target.value as Question["kind"]);
                setQ({
                  ...next,
                  id: q.id,
                  title: q.title,
                  image: q.image,
                  tags: q.tags,
                  explanation: q.explanation,
                  hints: q.hints || [],
                  difficulty: difficultyOf(q),
                  points: q.points,
                  hopeStar: q.hopeStar,
                  ...("solution" in next && "solution" in q
                    ? { solution: q.solution }
                    : {}),
                } as Question);
              }}
            >
              {Object.entries(kindLabels).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Độ khó
            <select
              value={difficultyOf(q)}
              onChange={(e) =>
                patch({
                  difficulty: e.target.value as Question["difficulty"],
                  points: pointsForDifficulty(
                    e.target.value as Question["difficulty"],
                  ),
                })
              }
            >
              {Object.entries(difficultyLabels).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="question-editor-body">
          <div className="form-stack editor-media-column">
            <MediaField
              label="Ảnh câu hỏi"
              value={q.image}
              busy={uploading}
              onChange={(image) => patch({ image })}
              onUpload={(file) => upload(file)}
            />
            {(q.kind === "locate" || q.kind === "change") && (
              <details
                className="editor-details"
                open={q.afterImage ? true : undefined}
              >
                <summary>
                  {q.kind === "locate"
                    ? "Ảnh đáp án (tùy chọn)"
                    : "Ảnh thứ hai (tùy chọn)"}
                </summary>
                <MediaField
                  label={q.kind === "locate" ? "Ảnh đáp án" : "Ảnh thứ hai"}
                  value={q.afterImage || ""}
                  busy={uploading}
                  onChange={(afterImage) => patch({ afterImage })}
                  onUpload={(file) => upload(file, "afterImage")}
                />
              </details>
            )}
          </div>
          <div className="form-stack editor-content-column">
            <label>
              Câu hỏi
              <textarea
                value={q.title}
                onChange={(e) => patch({ title: e.target.value })}
                rows={3}
                maxLength={220}
                placeholder="Nhập câu hỏi…"
                required
              />
            </label>
            {q.kind === "choice" ? (
              <fieldset className="options-editor">
                <legend>
                  Đáp án <small>Đánh dấu đáp án đúng</small>
                </legend>
                {q.options.map((option, i) => (
                  <div key={i} className={q.correct === i ? "correct" : ""}>
                    <input
                      type="radio"
                      aria-label={`Đáp án đúng ${String.fromCharCode(65 + i)}`}
                      name="correct"
                      checked={q.correct === i}
                      onChange={() => patch({ correct: i })}
                    />
                    <span>{String.fromCharCode(65 + i)}</span>
                    <input
                      aria-label={`Đáp án ${String.fromCharCode(65 + i)}`}
                      value={option}
                      maxLength={160}
                      required
                      onChange={(e) =>
                        patch({
                          options: q.options.map((o, j) =>
                            j === i ? e.target.value : o,
                          ),
                        })
                      }
                    />
                    {q.options.length > 2 && (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Bỏ đáp án ${String.fromCharCode(65 + i)}`}
                        onClick={() =>
                          patch({
                            options: q.options.filter((_, j) => i !== j),
                            correct:
                              q.correct === i
                                ? 0
                                : q.correct > i
                                  ? q.correct - 1
                                  : q.correct,
                          })
                        }
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                ))}
                {q.options.length < 4 && (
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => patch({ options: [...q.options, ""] })}
                  >
                    + Thêm đáp án
                  </button>
                )}
              </fieldset>
            ) : q.kind === "puzzle" ? (
              <label>
                Số mảnh
                <select
                  value={q.grid}
                  onChange={(e) =>
                    patch({ grid: Number(e.target.value) as 2 | 3 })
                  }
                >
                  <option value={2}>4 mảnh (2 × 2)</option>
                  <option value={3}>9 mảnh (3 × 3)</option>
                </select>
              </label>
            ) : (
              <EarthFields question={q} onChange={setQ} />
            )}
            <HintFields
              hints={q.hints || []}
              uploading={uploading}
              onChange={(hints) => patch({ hints })}
              onUpload={(index, file) =>
                upload(file, (url) =>
                  setQ((current) => ({
                    ...current,
                    hints: hintSlots(current.hints).map((hint, i) =>
                      i === index ? { type: "image", image: url } : hint,
                    ),
                  })),
                )
              }
            />
            <label>
              Giải thích / thông tin thêm <small>(tùy chọn)</small>
              <textarea
                rows={3}
                maxLength={2000}
                value={q.explanation}
                onChange={(e) => patch({ explanation: e.target.value })}
              />
            </label>
            <details className="editor-details">
              <summary>
                Điểm
                {q.kind === "choice" || q.kind === "puzzle"
                  ? ", thời gian"
                  : ""}{" "}
                và nhãn
              </summary>
              <div className="form-stack">
                <div className="field-pair">
                  <label>
                    Điểm
                    <input
                      type="number"
                      value={pointsForDifficulty(q.difficulty)}
                      readOnly
                    />
                  </label>
                  {(q.kind === "choice" || q.kind === "puzzle") && (
                    <label>
                      Thời gian (giây)
                      <input
                        type="number"
                        value={q.seconds}
                        min={15}
                        max={600}
                        onChange={(e) =>
                          patch({ seconds: Number(e.target.value) })
                        }
                      />
                    </label>
                  )}
                </div>
                <label className="toggle-field">
                  <input
                    type="checkbox"
                    checked={Boolean(q.hopeStar)}
                    onChange={(e) => patch({ hopeStar: e.target.checked })}
                  />
                  <span>
                    Cho phép ngôi sao hy vọng{" "}
                    <small>Đúng ×2 · mỗi người 1 sao/phiên</small>
                  </span>
                </label>
                <label>
                  Nhãn
                  <input
                    value={q.tags.join(", ")}
                    onChange={(e) =>
                      patch({
                        tags: e.target.value
                          .split(",")
                          .map((t) => t.trimStart())
                          .slice(0, 8),
                      })
                    }
                    placeholder="Cách nhau bằng dấu phẩy"
                  />
                </label>
              </div>
            </details>
          </div>
        </div>
      </div>
    </form>
  );
}
