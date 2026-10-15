"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Download, Eye, Maximize } from "lucide-react";
import { command } from "@/shared/client/api";
import { ErrorMessage, Loading } from "@/shared/ui/status";
import type { Question } from "@/features/questions/model";
import type { QuestionSet } from "@/features/questions/sets-page";
import type { GameView, SessionPlan } from "@/features/sessions/model";
import { EarthStage, ImageViewer } from "@/features/play/earth-games";
import { GameHints } from "@/features/play/game-hints";
import { embedImages, presentationHtml } from "./offline";

export function PresentationPage({
  id,
  source,
}: {
  id: string;
  source: "set" | "session";
}) {
  const [questions, setQuestions] = useState<Question[]>([]),
    [title, setTitle] = useState("");
  const [index, setIndex] = useState(0),
    [opened, setOpened] = useState(0),
    [reveal, setReveal] = useState(false);
  const [penalty, setPenalty] = useState(false),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  const screen = useRef<HTMLDivElement>(null);
  const back =
    source === "session" ? `/admin/sessions/${id}/` : `/admin/sets/${id}/`;
  useEffect(() => {
    let cancelled = false;
    async function load() {
      let list: Question[], name: string;
      if (source === "session") {
        const [plan, g] = await Promise.all([
          command<SessionPlan>("session_plan", { p_id: id }),
          command<GameView>("session_view", { p_id: id }),
        ]);
        list = plan.questions;
        name = plan.title;
        if (!cancelled) {
          setIndex(g.index);
          setOpened(g.hintCount);
          setPenalty(plan.hintPenalty === 50);
        }
      } else {
        const [bank, sets] = await Promise.all([
          command<Question[]>("bank_list"),
          command<QuestionSet[]>("set_list"),
        ]);
        const set = sets.find((s) => s.id === id);
        if (!set) throw new Error("Không tìm thấy bộ câu hỏi.");
        name = set.title;
        list = set.questionIds.map((qid) => {
          const q = bank.find((q) => q.id === qid);
          if (!q)
            throw new Error(
              "Có câu đã được lưu trữ. Sửa bộ câu hỏi trước khi trình chiếu.",
            );
          return q;
        });
      }
      if (!list.length) throw new Error("Bộ này chưa có câu hỏi.");
      if (cancelled) return;
      setTitle(name);
      setQuestions(list);
      try {
        const embedded = await embedImages(list);
        if (!cancelled) {
          setQuestions(embedded);
          setReady(true);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    }
    load().catch((e) => {
      if (!cancelled) setError(e.message);
    });
    return () => {
      cancelled = true;
    };
  }, [id, source]);
  function move(next: number) {
    const target = Math.max(0, Math.min(questions.length - 1, next));
    if (target === index) return;
    setIndex(target);
    setOpened(0);
    setReveal(false);
  }
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (
        /INPUT|SELECT|TEXTAREA|BUTTON/.test(
          (event.target as HTMLElement).tagName,
        )
      )
        return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        move(index + 1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(index - 1);
      }
      if (event.key === " ") {
        event.preventDefault();
        setReveal((v) => !v);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [index, questions.length]);
  function download() {
    const url = URL.createObjectURL(
      new Blob([presentationHtml(title, questions, penalty ? 50 : 0)], {
        type: "text/html;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "earthplay-workshop.html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const q = questions[index];
  if (!q)
    return (
      <>
        <ErrorMessage message={error} />
        {!error && <Loading />}
        <Link href={back}>Quay lại</Link>
      </>
    );
  return (
    <div
      ref={screen}
      className="game-screen projector is-controller manual-presentation"
    >
      <header className="game-header">
        <Link href={back} className="presentation-tool">
          <ArrowLeft size={16} /> Quay lại
        </Link>
        <span>Chỉ trình chiếu</span>
        <div className="game-header-end">
          <select
            aria-label="Chọn câu hỏi"
            value={index}
            onChange={(e) => move(Number(e.target.value))}
          >
            {questions.map((q, i) => (
              <option key={q.id} value={i}>
                Câu {i + 1} / {questions.length}
              </option>
            ))}
          </select>
          <button
            className="presentation-tool"
            disabled={!ready}
            onClick={download}
          >
            <Download size={16} /> Tải bản dự phòng
          </button>
          <button
            className="icon-button fullscreen-toggle"
            aria-label="Toàn màn hình"
            onClick={() => {
              const action = document.fullscreenElement
                ? document.exitFullscreen()
                : screen.current?.requestFullscreen();
              action?.catch(() => setError("Dùng F11 để mở toàn màn hình."));
            }}
          >
            <Maximize size={19} />
          </button>
        </div>
      </header>
      <ErrorMessage message={error} />
      <main className={`question-stage kind-${q.kind}`}>
        <div className="question-heading">
          <p className="question-chip">
            {Math.max(0, q.points - opened * (penalty ? 50 : 0))} điểm
          </p>
          <h1>{q.title}</h1>
        </div>
        {q.kind === "choice" ? (
          <>
            {q.image && (
              <ImageViewer
                key={q.id}
                src={reveal && q.answerImage ? q.answerImage : q.image}
              />
            )}
            <div className="answer-grid">
              {q.options.map((text, i) => (
                <div
                  key={i}
                  className={`answer-color color-${i} ${reveal && i === q.correct ? "is-correct" : ""}`}
                >
                  <span className="answer-letter">{"ABCD"[i]}</span>
                  <strong>{text}</strong>
                </div>
              ))}
            </div>
          </>
        ) : q.kind === "puzzle" ? (
          <ImageViewer key={q.id} src={q.image} />
        ) : (
          <EarthStage
            question={q}
            roundId={`${q.id}:${reveal}`}
            reveal={reveal}
            interactive={false}
          />
        )}
        {opened > 0 && <GameHints hints={q.hints.slice(0, opened)} />}
        {reveal && q.explanation && (
          <p className="answer-explanation">{q.explanation}</p>
        )}
      </main>
      <footer className="host-controls">
        <div className="host-secondary">
          <label className="manual-penalty">
            <input
              type="checkbox"
              checked={penalty}
              onChange={(e) => setPenalty(e.target.checked)}
            />{" "}
            Mỗi gợi ý −50 điểm
          </label>
        </div>
        <div className="host-main-actions">
          <button
            className="button secondary"
            disabled={index === 0}
            onClick={() => move(index - 1)}
          >
            <ArrowLeft size={17} /> Câu trước
          </button>
          <button
            className="button secondary"
            disabled={reveal || opened >= q.hints.length}
            onClick={() => setOpened((v) => Math.min(q.hints.length, v + 1))}
          >
            Mở gợi ý {opened + 1}
            {penalty ? " (−50)" : ""}
          </button>
          <button
            className="button primary"
            onClick={() => setReveal((v) => !v)}
          >
            <Eye size={17} /> {reveal ? "Ẩn đáp án" : "Xem đáp án"}
          </button>
          <button
            className="button primary"
            disabled={index + 1 >= questions.length}
            onClick={() => move(index + 1)}
          >
            Câu tiếp theo <ArrowRight size={17} />
          </button>
        </div>
      </footer>
    </div>
  );
}
