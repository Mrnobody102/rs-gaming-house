"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Eye,
  Maximize,
  Minimize,
  SlidersHorizontal,
  Send,
  Trophy,
  Users,
  Star,
  X,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { command, CommandError, getConfig } from "@/shared/client/api";
import { ErrorMessage, Loading } from "@/shared/ui/status";
import { kindLabels, type Answer } from "@/features/questions/model";
import type { Control, GameView } from "@/features/sessions/model";
import { useGame } from "./use-game";
import { Puzzle } from "./puzzle";
import { EarthStage } from "./earth-games";
import { usesBuzz } from "@/features/games/catalog";
import { usesProgressiveHints } from "@/features/games/hints";
import { readPlayerSession } from "@/shared/client/player-session";
import { Ranking } from "./ranking";
import { SessionContents } from "@/features/sessions/session-contents";
import { GameHints } from "./game-hints";
import { TiebreakControls } from "./tiebreak-controls";
export function GameScreen({
  id,
  host = false,
  projector = false,
  accessToken = "",
  joinBase = "",
}: {
  id: string;
  host?: boolean;
  projector?: boolean;
  accessToken?: string;
  joinBase?: string;
}) {
  const [token, setToken] = useState<string | null>(host ? "" : null);
  useEffect(() => {
    if (host) {
      setToken("");
      return;
    }
    try {
      setToken(
        accessToken || readPlayerSession(`earthplay.player:${id}`) || "",
      );
    } catch {
      setToken(accessToken);
    }
  }, [id, host, accessToken]);
  if (token === null) return <Loading />;
  if (!host && !token)
    return (
      <main className="game-empty">
        <Brand />
        <p>Nhập mã phòng để tham gia.</p>
        <Link className="button primary" href="/">
          Vào game
        </Link>
      </main>
    );
  return (
    <LiveGame
      key={`${id}:${token}`}
      id={id}
      token={token}
      host={host}
      projector={projector}
      joinBase={joinBase}
    />
  );
}
function LiveGame({
  id,
  token,
  host,
  projector,
  joinBase,
}: {
  id: string;
  token: string;
  host: boolean;
  projector: boolean;
  joinBase: string;
}) {
  const { game: g, receive, error, online, offset } = useGame(id, token);
  const [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState(""),
    [now, setNow] = useState(Date.now()),
    [tiles, setTiles] = useState<number[]>([]),
    [base, setBase] = useState(joinBase);
  const updateTiles = useCallback((value: number[]) => setTiles(value), []);
  const actionPending = useRef(false);
  const networkActionError = useRef(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setActionError("");
  }, [g?.roundId, g?.buzzId, g?.phase]);
  useEffect(() => {
    if (networkActionError.current) {
      setActionError("");
      networkActionError.current = false;
    }
  }, [g?.serverTime]);
  useEffect(() => {
    const update = () =>
      setIsFullscreen(document.fullscreenElement === screenRef.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  useEffect(() => {
    if (joinBase) setBase(joinBase);
    else
      getConfig()
        .then((c) => setBase(c.joinBaseUrl || location.origin))
        .catch(() => setBase(location.origin));
  }, [joinBase]);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(tick);
  }, []);
  async function run(name: string, args: object = {}) {
    if (actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setActionError("");
    try {
      receive(await command<GameView>(name, { p_id: id, ...args }));
    } catch (e) {
      setActionError((e as Error).message);
      networkActionError.current =
        e instanceof CommandError && e.code === "NETWORK_UNAVAILABLE";
      if (e instanceof CommandError && e.code === "BUZZ_CLIENT_OUTDATED")
        setNeedsReload(true);
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }
  function control(action: Control) {
    if (g)
      void run("session_control", { p_action: action, p_round_id: g.roundId });
  }
  function answer(payload: Answer) {
    if (g)
      void run("answer_submit", {
        p_round_id: g.roundId,
        p_token: token,
        p_payload: payload,
      });
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement === screenRef.current)
        await document.exitFullscreen();
      else await screenRef.current?.requestFullscreen();
    } catch {
      setActionError("Bạn có thể dùng F11 để mở toàn màn hình.");
    }
  }
  if (!g)
    return (
      <main className="game-empty">
        <Brand />
        {error ? (
          <>
            <ErrorMessage message={error} />
            <Link
              href={host ? "/admin/sessions/" : "/"}
              className="button secondary"
            >
              {host ? "Về danh sách phòng" : "Về màn nhập mã"}
            </Link>
          </>
        ) : (
          <Loading />
        )}
      </main>
    );
  const q = g.question,
    reveal = ["result", "leaderboard", "finished"].includes(g.phase),
    scoreboard = g.phase === "leaderboard" || g.phase === "finished",
    eo = usesBuzz(q);
  const canControl = (host || projector) && g.host;
  const pendingGrade = !!g.buzzWinner && !g.buzzWinner.graded;
  const noBuzzRemaining = g.count > 0 && g.buzzRemaining === 0;
  const seconds = g.deadline
    ? Math.max(0, Math.ceil((Date.parse(g.deadline) - now - offset) / 1000))
    : q.seconds;
  const locked =
      busy ||
      !online ||
      g.phase !== "question" ||
      (!eo && seconds === 0) ||
      !!g.myAnswer,
    canAnswer =
      !host && !projector && (!g.tiebreak?.active || g.tiebreak.myEligible);
  const missingBuzzWindow = eo && g.buzzOpen && !g.buzzId;
  function buzz() {
    // Pointer events can reach a disabled button on some browsers.
    if (!g || !canAnswer || locked || !g.buzzOpen || !g.buzzId) return;
    void run("buzz_submit", {
      p_round_id: g.roundId,
      p_buzz_id: g.buzzId,
      p_token: token,
    });
  }
  const joinUrl = `${base.replace(/\/$/, "")}/?code=${g.code}`,
    me = g.standings.find((p) => p.id === g.myId);
  const buzzPanel = eo && !reveal && (
    <div className="buzz-area">
      {canAnswer && g.myAnswer ? (
        <p className="feedback incorrect">
          Chưa đúng · 0 điểm. Chờ câu tiếp theo.
        </p>
      ) : g.buzzWinner ? (
        <p className="buzz-winner">
          <strong>{g.buzzWinner.name}</strong> giành quyền trả lời
          {g.buzzWinner.elapsedMs != null && (
            <small className="buzz-time">
              {(g.buzzWinner.elapsedMs / 1000).toFixed(3)} s
            </small>
          )}
          {g.buzzWinner.hopeStar && (
            <span className="winner-star">
              <Star size={16} fill="currentColor" /> ×2
            </span>
          )}
        </p>
      ) : canAnswer ? (
        <button
          className={`buzz-button ${g.buzzOpen ? "open" : ""}`}
          disabled={locked || !g.buzzOpen || !g.buzzId}
          onPointerDown={(event) => {
            if (event.button === 0) buzz();
          }}
          onClick={(event) => {
            if (event.detail === 0) buzz();
          }}
        >
          BUZZ
        </button>
      ) : (
        <p className="waiting-label">
          {!host && !projector && g.tiebreak?.active && !g.tiebreak.myEligible
            ? "Chờ nhóm đồng điểm phân hạng."
            : noBuzzRemaining
              ? "Mọi người đã trả lời · Xem đáp án"
              : g.buzzOpen
                ? "BUZZ đang mở"
                : g.answered > 0
                  ? `Còn ${g.buzzRemaining} lượt · BUZZ chưa mở`
                  : "BUZZ chưa mở"}
        </p>
      )}
      {canAnswer && g.buzzWinner?.id === g.myId && (
        <p>Bạn được quyền trả lời.</p>
      )}
    </div>
  );
  return (
    <div
      ref={screenRef}
      className={`game-screen ${projector ? "projector" : ""} ${canControl ? "is-controller" : "is-player"} ${projector && canControl && !showControls ? "controls-hidden" : ""}`}
    >
      <header className="game-header">
        <Brand small />
        <span className="game-position">
          {g.tiebreak?.active ? "Câu dự bị" : `Câu ${g.index + 1} / ${g.total}`}
        </span>
        <div className="game-header-end">
          {canControl && (
            <Link
              className="presentation-tool"
              href={`/admin/present/${id}/?source=session`}
            >
              Chỉ trình chiếu
            </Link>
          )}
          {projector && canControl && (
            <>
              <Link
                className="presentation-tool"
                href={`/admin/sessions/${id}/`}
                title="Về màn điều khiển MC"
              >
                <ArrowLeft size={17} />
                <span>Quản trị</span>
              </Link>
              <button
                className="presentation-tool"
                aria-label={showControls ? "Ẩn điều khiển" : "Hiện điều khiển"}
                aria-pressed={showControls}
                onClick={() => setShowControls((v) => !v)}
              >
                <SlidersHorizontal size={17} />
                <span>
                  {showControls ? "Ẩn điều khiển" : "Hiện điều khiển"}
                </span>
              </button>
            </>
          )}
          <span className="room-code">{g.code}</span>
          <span className="player-count">
            <Users size={16} />
            {g.count}
          </span>
          {g.phase === "question" && !eo && (
            <span
              className={`game-timer ${seconds <= 10 ? "urgent" : ""}`}
              role="timer"
            >
              {seconds}
              <small>giây</small>
            </span>
          )}
          <button
            className="icon-button fullscreen-toggle"
            aria-label={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
            onClick={fullscreen}
          >
            {isFullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
          </button>
        </div>
      </header>
      <ErrorMessage
        message={
          actionError ||
          (missingBuzzWindow
            ? "Màn chơi chưa cập nhật mã lượt chuông. Tải lại màn chơi để tiếp tục."
            : !online
              ? "Mất kết nối. Đang thử kết nối lại…"
              : "")
        }
      />
      {(needsReload || missingBuzzWindow) && (
        <div className="game-reload">
          <button
            className="button secondary small"
            onClick={() => location.reload()}
          >
            Tải lại màn chơi
          </button>
        </div>
      )}
      {g.phase === "lobby" ? (
        <main className="room-lobby">
          <div className="room-entry">
            <p className="eyebrow">MÃ PHÒNG</p>
            <h1>{g.code}</h1>
            <h2>{g.title}</h2>
            <div className="room-qr">
              <img
                src={`/api/qr/?url=${encodeURIComponent(joinUrl)}`}
                alt={`QR tham gia phòng ${g.code}`}
                width={180}
                height={180}
              />
            </div>
            <a className="room-address" href={joinUrl}>
              {base.replace(/^https?:\/\//, "")}
            </a>
            {host && (
              <label className="join-address-editor">
                Địa chỉ cho người chơi
                <input
                  aria-label="Địa chỉ tham gia"
                  value={base}
                  onChange={(e) => setBase(e.target.value)}
                />
              </label>
            )}
          </div>
          <div className="room-players">
            <p>
              <strong>{g.count}</strong> người đã vào
            </p>
            <div className="player-bubbles">
              {g.standings.map((p) => (
                <span key={p.id}>{p.name}</span>
              ))}
            </div>
            {!host && !projector && (
              <p className="waiting-label">Chờ MC bắt đầu…</p>
            )}
            <p className="lobby-rules">
              Dễ 200 · Vừa 300 · Khó 400 điểm
              {g.hintPenalty > 0 && (
                <>
                  <br />
                  Mỗi gợi ý trừ {g.hintPenalty} điểm
                </>
              )}
              {g.starRounds > 0 && (
                <>
                  <br />1 sao/người · đúng ×2 · sai 0
                </>
              )}
            </p>
            {host && <SessionContents id={id} total={g.total} />}
          </div>
        </main>
      ) : scoreboard ? (
        <Ranking
          standings={g.standings}
          myId={g.myId}
          finished={g.phase === "finished"}
          pending={g.tiebreak?.pending}
          controls={
            canControl && g.tiebreak?.pending ? (
              <TiebreakControls game={g} busy={busy} onRun={run} />
            ) : undefined
          }
        />
      ) : (
        <main
          key={`${g.roundId}:${reveal}`}
          className={`question-stage kind-${q.kind}`}
        >
          <div className="question-heading">
            <p className="question-chip">
              {kindLabels[q.kind].toLocaleUpperCase("vi")}
              <span>
                {g.tiebreak?.active ? "· Phân hạng" : `· ${q.points} điểm`}
              </span>
              {q.hopeStar && (
                <span className="star-round-badge">
                  <Star size={14} /> Câu ngôi sao
                </span>
              )}
            </p>
            <h1>{q.title}</h1>
            {g.tiebreak?.active && (
              <p className="tie-round-label">
                Dành cho {g.tiebreak.candidates.map((p) => p.name).join(" · ")}
              </p>
            )}
          </div>
          {canAnswer && !reveal && q.hopeStar && (
            <div className="hope-star">
              <button
                type="button"
                className={`star-choice ${g.star?.selected ? "selected" : ""}`}
                aria-label="Ngôi sao hy vọng"
                aria-pressed={Boolean(g.star?.selected)}
                disabled={locked || g.star?.used || g.buzzWinner?.id === g.myId}
                onClick={() =>
                  run("star_select", {
                    p_round_id: g.roundId,
                    p_token: token,
                    p_active: !g.star?.selected,
                  })
                }
              >
                <Star
                  size={21}
                  fill={g.star?.selected ? "currentColor" : "none"}
                />
                <span>
                  {g.star?.used
                    ? "Đã dùng sao"
                    : g.star?.selected
                      ? "Đã chọn ngôi sao"
                      : "Ngôi sao hy vọng"}
                </span>
                <b>×2</b>
              </button>
              <small>
                {g.star?.used
                  ? "Đã dùng ngôi sao trong phiên này"
                  : g.star?.selected
                    ? `Đúng +${q.points * 2} · sai 0`
                    : "Chọn trước khi trả lời · chỉ dùng khi được chấm"}
              </small>
            </div>
          )}
          {q.kind === "choice" ? (
            <>
              {q.image && (
                <img
                  className="question-image"
                  src={q.image}
                  alt="Ảnh câu hỏi"
                />
              )}
              <div className="answer-grid">
                {q.options.map((text, i) => {
                  const chosen =
                    g.myAnswer &&
                    "choice" in g.myAnswer.payload &&
                    g.myAnswer.payload.choice === i;
                  return (
                    <button
                      key={i}
                      disabled={eo || !canAnswer || locked}
                      className={`answer-color color-${i} ${reveal ? (q.correct === i ? "is-correct" : "is-wrong") : ""} ${chosen ? "is-chosen" : ""}`}
                      onClick={() => answer({ choice: i })}
                    >
                      <span className="answer-letter">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <strong>{text}</strong>
                      {reveal && q.correct === i ? (
                        <Check size={23} />
                      ) : chosen ? (
                        <span className="chosen-check">
                          <Check size={15} />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </>
          ) : q.kind === "puzzle" ? (
            <div className="puzzle-play">
              <Puzzle
                key={g.roundId}
                image={q.image}
                grid={q.grid}
                roundId={g.roundId}
                disabled={!canAnswer || locked}
                result={reveal}
                onChange={updateTiles}
              />
              {canAnswer && !reveal && (
                <div className="puzzle-actions">
                  <span>Chọn hai mảnh để đổi chỗ.</span>
                  <button
                    className="button primary"
                    disabled={locked || !tiles.length}
                    onClick={() => answer({ tiles })}
                  >
                    <Send size={16} /> Gửi đáp án
                  </button>
                </div>
              )}
            </div>
          ) : (
            <EarthStage
              question={q}
              reveal={reveal}
              interactive={canControl && !projector}
              roundId={g.roundId}
              guess={g.guess}
              onGuess={(point) =>
                run("session_guess", {
                  p_round_id: g.roundId,
                  p_lng: point.lng,
                  p_lat: point.lat,
                })
              }
            />
          )}
          {!canAnswer &&
            (!canControl || (projector && !showControls)) &&
            buzzPanel}
          {q.hints?.length > 0 && (
            <GameHints
              hints={q.hints}
              hideImages={usesProgressiveHints(q)}
              follow={!reveal}
            />
          )}
          {canAnswer && g.myAnswer && (!eo || reveal) && (
            <p
              className={`feedback ${reveal ? (g.myAnswer.correct ? "correct" : "incorrect") : "submitted"}`}
            >
              {reveal ? (
                g.myAnswer.correct ? (
                  g.tiebreak?.active ? (
                    `Đúng · giành hạng ${me?.rank}`
                  ) : (
                    `+${g.myAnswer.points} điểm`
                  )
                ) : (
                  "Chưa đúng · 0 điểm"
                )
              ) : (
                <>
                  <Check size={18} /> Đã gửi. Chờ đáp án…
                </>
              )}
            </p>
          )}
          {reveal && q.explanation && (
            <p className="answer-explanation">{q.explanation}</p>
          )}
        </main>
      )}
      {canAnswer && g.phase === "question" && !scoreboard && eo && (
        <div className="buzz-dock">{buzzPanel}</div>
      )}
      {canControl && (!projector || showControls) ? (
        <footer className="host-controls">
          <div className="host-secondary">
            {g.phase === "question" ? (
              <>
                {eo ? (
                  buzzPanel
                ) : (
                  <span>
                    {g.answered} / {g.count} đã trả lời
                  </span>
                )}
                {g.hintCount < g.hintTotal && (
                  <button
                    className="button secondary small"
                    disabled={busy || (g.hintPenalty > 0 && !!g.buzzWinner)}
                    onClick={() =>
                      run("session_hint", { p_round_id: g.roundId })
                    }
                  >
                    Mở gợi ý {g.hintCount + 1}
                    {g.hintPenalty > 0 && ` (−${g.hintPenalty})`}
                  </button>
                )}
              </>
            ) : (
              <span>{g.count} người chơi</span>
            )}
          </div>
          <div className="host-main-actions">
            {g.phase === "lobby" ? (
              <button
                className="button primary"
                disabled={busy}
                onClick={() => control("start")}
              >
                Bắt đầu <ArrowRight size={17} />
              </button>
            ) : g.phase === "question" ? (
              <>
                {eo &&
                  (g.buzzWinner && !g.buzzWinner.graded ? (
                    <>
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() =>
                          run("buzz_grade", {
                            p_round_id: g.roundId,
                            p_participant_id: g.buzzWinner!.id,
                            p_correct: false,
                          })
                        }
                      >
                        <X size={17} /> Sai
                      </button>
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() =>
                          run("buzz_grade", {
                            p_round_id: g.roundId,
                            p_participant_id: g.buzzWinner!.id,
                            p_correct: true,
                          })
                        }
                      >
                        <Check size={17} />{" "}
                        {g.tiebreak?.active
                          ? "Đúng · giành hạng"
                          : `Đúng · +${q.points * (g.buzzWinner?.hopeStar ? 2 : 1)}`}
                      </button>
                    </>
                  ) : (
                    <button
                      className="button secondary"
                      disabled={busy || (!g.buzzOpen && noBuzzRemaining)}
                      onClick={() =>
                        run("buzz_control", {
                          p_round_id: g.roundId,
                          p_open: !g.buzzOpen,
                        })
                      }
                    >
                      {g.buzzOpen ? "Đóng BUZZ" : "Mở BUZZ"}
                    </button>
                  ))}
                <button
                  className="button primary"
                  disabled={busy || (eo && pendingGrade)}
                  title={
                    eo && pendingGrade
                      ? "Chấm đúng hoặc sai trước khi mở đáp án"
                      : undefined
                  }
                  onClick={() => control("reveal")}
                >
                  <Eye size={17} /> Xem đáp án
                </button>
              </>
            ) : g.phase === "result" ? (
              <button
                className="button primary"
                disabled={busy}
                onClick={() => control("leaderboard")}
              >
                Bảng điểm <Trophy size={17} />
              </button>
            ) : g.phase === "leaderboard" ? (
              <button
                className="button primary"
                disabled={busy}
                onClick={() => control("next")}
              >
                {g.index + 1 === g.total ? "Kết thúc" : "Câu tiếp theo"}
                <ArrowRight size={17} />
              </button>
            ) : (
              <Link className="button primary" href="/admin/sessions/new/">
                Tạo lượt chơi mới
              </Link>
            )}
          </div>
        </footer>
      ) : (
        !projector && (
          <footer className="player-footer">
            <strong>{me?.name}</strong>
            <span>{me?.score || 0} điểm</span>
          </footer>
        )
      )}
    </div>
  );
}
