"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Check,
  Plus,
  X,
  Star,
} from "lucide-react";
import { command } from "@/shared/client/api";
import { ErrorMessage, Loading } from "@/shared/ui/status";
import {
  kindLabels,
  type Question,
  sessionInputSchema,
} from "@/features/questions/model";
import type { QuestionSet } from "@/features/questions/sets-page";
import {
  difficultyLabels,
  difficultyOf,
} from "@/features/questions/difficulty";
import { filterQuestions } from "@/features/questions/filter";
import { randomId } from "@/shared/client/random";
import { pointsForDifficulty } from "@/features/games/scoring";
import type { SessionPlan } from "./model";
import { ReserveFields } from "@/features/questions/reserve-fields";
export function CreateSession({
  setId,
  initialSetId,
  sessionId,
}: { setId?: string; initialSetId?: string; sessionId?: string } = {}) {
  const [bank, setBank] = useState<Question[] | null>(null),
    [ids, setIds] = useState<string[]>([]),
    [title, setTitle] = useState(""),
    [capacity, setCapacity] = useState(60),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [starIds, setStarIds] = useState<string[]>([]);
  const [hintPenalty, setHintPenalty] = useState<0 | 50>(0);
  const [reserveIds, setReserveIds] = useState<string[]>([]);
  const [editable, setEditable] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [draftId] = useState(randomId);
  const [sets, setSets] = useState<QuestionSet[]>([]),
    [selectedSet, setSelectedSet] = useState(initialSetId || "");
  const editingSet = Boolean(setId);
  const [query, setQuery] = useState(""),
    [kind, setKind] = useState("all"),
    [difficulty, setDifficulty] = useState("all");
  const router = useRouter();
  useEffect(() => {
    Promise.all([
      command<Question[]>("bank_list"),
      command<QuestionSet[]>("set_list"),
      sessionId
        ? command<SessionPlan>("session_plan", { p_id: sessionId })
        : Promise.resolve(null),
    ])
      .then(([questions, templates, plan]) => {
        setBank(questions);
        setSets(templates);
        if (plan) {
          setTitle(plan.title);
          setCapacity(plan.capacity);
          setHintPenalty(plan.hintPenalty || 0);
          setIds(plan.questionIds);
          setStarIds(plan.starQuestionIds);
          setReserveIds(plan.reserveQuestionIds || []);
          const snapshots = [
            ...plan.questions,
            ...(plan.reserveQuestions || []),
          ];
          setBank([
            ...snapshots,
            ...questions.filter(
              (q) => !snapshots.some((saved) => saved.id === q.id),
            ),
          ]);
          if (plan.phase !== "lobby") {
            setEditable(false);
            setError("Phiên đã bắt đầu, không thể sửa nội dung.");
          }
        } else if ((setId && setId !== "new") || initialSetId) {
          const saved = templates.find((s) => s.id === (setId || initialSetId));
          if (!saved) throw new Error("Không tìm thấy bộ câu hỏi.");
          setTitle(saved.title);
          setStarIds(saved.starQuestionIds || []);
          setReserveIds(saved.reserveQuestionIds || []);
          setIds(saved.questionIds);
        }
      })
      .catch((e) => {
        setError(e.message);
        setLoadFailed(true);
        setEditable(false);
      })
      .finally(() => setBusy(false));
  }, [setId, initialSetId, sessionId]);
  function move(i: number, direction: number) {
    setIds((list) => {
      const copy = [...list];
      [copy[i], copy[i + direction]] = [copy[i + direction], copy[i]];
      return copy;
    });
  }
  async function authorQuestion() {
    if (!setId || setId === "new") return;
    const valid = sessionInputSchema.pick({ title: true }).safeParse({ title });
    if (!valid.success) {
      setError(valid.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await command("set_save", {
        p_id: setId,
        p_title: title,
        p_question_ids: ids,
        p_star_question_ids: starIds.filter((id) => ids.includes(id)),
        p_reserve_question_ids: reserveIds.filter((id) => !ids.includes(id)),
      });
      router.push(`/admin/questions/new/?set=${setId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      title,
      capacity,
      hintPenalty,
      questionIds: ids,
      starQuestionIds: starIds.filter((id) => ids.includes(id)),
      reserveQuestionIds: reserveIds.filter((id) => !ids.includes(id)),
      ...(selectedSet ? { setId: selectedSet } : {}),
    };
    const result = (
      editingSet ? sessionInputSchema.pick({ title: true }) : sessionInputSchema
    ).safeParse(payload);
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      if (editingSet) {
        const savedId = setId === "new" ? draftId : setId;
        await command("set_save", {
          p_id: savedId,
          p_title: title,
          p_question_ids: ids,
          p_star_question_ids: payload.starQuestionIds,
          p_reserve_question_ids: payload.reserveQuestionIds,
        });
        router.push(
          setId === "new" ? `/admin/sets/${savedId}/` : "/admin/sets/",
        );
      } else if (sessionId) {
        await command("session_plan_save", { ...payload, id: sessionId });
        router.push(`/admin/sessions/${sessionId}/`);
      } else {
        const s = await command<{ id: string }>("session_create", payload);
        router.push(`/admin/sessions/${s.id}/`);
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  if (!bank && !error) return <Loading />;
  if (loadFailed)
    return (
      <div className="panel form-stack">
        <ErrorMessage message={error} />
        <Link
          className="text-link"
          href={editingSet ? "/admin/sets/" : "/admin/sessions/"}
        >
          Về danh sách {editingSet ? "bộ câu hỏi" : "phòng chơi"}
        </Link>
      </div>
    );
  const missingIds = ids.filter((id) => !bank?.some((q) => q.id === id));
  return (
    <form onSubmit={create}>
      <div className="page-heading">
        <div>
          <Link
            href={
              editingSet
                ? "/admin/sets/"
                : sessionId
                  ? `/admin/sessions/${sessionId}/`
                  : "/admin/sessions/"
            }
            className="back-link"
          >
            <ArrowLeft size={15} /> {editingSet ? "Bộ câu hỏi" : "Phòng chơi"}
          </Link>
          <h1>
            {editingSet
              ? setId === "new"
                ? "Tạo bộ câu hỏi"
                : "Sửa bộ câu hỏi"
              : sessionId
                ? "Sửa phiên"
                : "Tạo phòng"}
          </h1>
        </div>
        <button
          className="button primary"
          disabled={
            busy ||
            (!editingSet && !ids.length) ||
            !editable ||
            missingIds.length > 0
          }
        >
          <Check size={18} />
          {busy
            ? "Đang lưu…"
            : editingSet
              ? !ids.length && setId === "new"
                ? "Tạo bộ và soạn câu"
                : "Lưu bộ câu hỏi"
              : sessionId
                ? "Lưu phiên"
                : "Tạo phòng"}
        </button>
      </div>
      <ErrorMessage message={error} />
      {missingIds.length > 0 && (
        <ErrorMessage
          message={`${missingIds.length} câu trong bộ đã được lưu trữ. Bỏ các câu đó khỏi thứ tự trước khi lưu hoặc tạo phòng.`}
        />
      )}
      <div className="editor-columns">
        <div className="form-stack">
          <section className="panel">
            {!editingSet && sets.length > 0 && (
              <label className="set-picker">
                Bộ câu hỏi
                <select
                  value={selectedSet}
                  onChange={(e) => {
                    setSelectedSet(e.target.value);
                    const saved = sets.find((s) => s.id === e.target.value);
                    if (saved) {
                      setTitle(saved.title);
                      setStarIds(saved.starQuestionIds || []);
                      setReserveIds(saved.reserveQuestionIds || []);
                      setIds(saved.questionIds);
                    }
                  }}
                >
                  <option value="">Tự chọn câu hỏi</option>
                  {sets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="form-stack">
              <label>
                {editingSet ? "Tên bộ câu hỏi" : "Tên phòng"}
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Chiều thứ sáu"
                  maxLength={100}
                  required
                />
              </label>
              {!editingSet && (
                <label className="toggle-field">
                  <input
                    type="checkbox"
                    checked={hintPenalty === 50}
                    onChange={(e) => setHintPenalty(e.target.checked ? 50 : 0)}
                  />
                  <span>
                    Mỗi gợi ý trừ 50 điểm{" "}
                    <small>Trừ trước khi nhân ngôi sao.</small>
                  </span>
                </label>
              )}
              {!editingSet && (
                <label>
                  Số người tối đa
                  <input
                    type="number"
                    min={2}
                    max={60}
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                  />
                </label>
              )}
            </div>
          </section>
          <section className="panel">
            <div className="set-question-heading">
              <h2>Chọn câu hỏi</h2>
              {setId && setId !== "new" && (
                <button
                  type="button"
                  className="text-link"
                  disabled={busy || missingIds.length > 0}
                  onClick={authorQuestion}
                >
                  <Plus size={15} />
                  <span>Soạn câu mới</span>
                </button>
              )}
            </div>
            <div className="question-pick-filters">
              <input
                aria-label="Tìm câu để tạo phòng"
                placeholder="Tìm câu hỏi…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                aria-label="Lọc game khi tạo phòng"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="all">Mọi game</option>
                {Object.entries(kindLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Lọc độ khó khi tạo phòng"
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
            <div className="bank-choices">
              {filterQuestions(bank || [], { query, kind, difficulty }).map(
                (q) => (
                  <button
                    type="button"
                    className={ids.includes(q.id) ? "selected" : ""}
                    onClick={() => {
                      if (!ids.includes(q.id))
                        setReserveIds((reserves) =>
                          reserves.filter((id) => id !== q.id),
                        );
                      if (!ids.includes(q.id) && q.hopeStar)
                        setStarIds((stars) => [
                          ...stars.filter((id) => id !== q.id),
                          q.id,
                        ]);
                      if (ids.includes(q.id))
                        setStarIds((stars) =>
                          stars.filter((id) => id !== q.id),
                        );
                      setIds(
                        ids.includes(q.id)
                          ? ids.filter((v) => v !== q.id)
                          : [...ids, q.id],
                      );
                    }}
                    key={q.id}
                  >
                    <span className="checkbox">
                      {ids.includes(q.id) && <Check size={14} />}
                    </span>
                    <div>
                      <strong>{q.title}</strong>
                      <small>
                        {kindLabels[q.kind]} ·{" "}
                        {difficultyLabels[difficultyOf(q)]} ·{" "}
                        {pointsForDifficulty(q.difficulty)} điểm
                      </small>
                    </div>
                  </button>
                ),
              )}
            </div>
            {!bank?.length && (
              <Link className="button secondary" href="/admin/questions/new/">
                <Plus size={17} /> Soạn câu hỏi
              </Link>
            )}
          </section>
          <ReserveFields
            bank={bank || []}
            mainIds={ids}
            ids={reserveIds}
            onChange={setReserveIds}
          />
        </div>
        <aside className="panel selected-questions">
          <h2>
            Thứ tự câu hỏi <span className="count">{ids.length}</span>
          </h2>
          <p className="set-scoring-note">Dễ 200 · Vừa 300 · Khó 400 điểm</p>
          {ids.map((id, i) => (
            <div className="ordered-question" key={id}>
              <span>{i + 1}</span>
              <div className="ordered-question-content">
                <strong>
                  {bank?.find((q) => q.id === id)?.title ||
                    "Câu hỏi đã lưu trữ"}
                </strong>
                <label className="round-star-toggle">
                  <input
                    type="checkbox"
                    checked={starIds.includes(id)}
                    onChange={(e) =>
                      setStarIds((stars) =>
                        e.target.checked
                          ? [...stars, id]
                          : stars.filter((x) => x !== id),
                      )
                    }
                  />
                  <Star size={13} /> Cho phép ngôi sao
                </label>
              </div>
              <div>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Đưa câu ${i + 1} lên`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Đưa câu ${i + 1} xuống`}
                  disabled={i === ids.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Bỏ câu ${i + 1}`}
                  onClick={() => setIds(ids.filter((x) => x !== id))}
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          ))}
          {!ids.length && <p className="muted">Chọn câu hỏi ở bên trái.</p>}
          {ids.length > 0 && (
            <p className="set-scoring-note">
              Mỗi người 1 sao/phiên. Đúng ×2, sai 0.
            </p>
          )}
        </aside>
      </div>
    </form>
  );
}
